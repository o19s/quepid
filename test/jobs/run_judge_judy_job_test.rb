# frozen_string_literal: true

require 'test_helper'

class RunJudgeJudyJobTest < ActiveJob::TestCase
  let(:book) { books(:james_bond_movies) }
  let(:judge_judy) { users(:judge_judy) }

  setup { register_default_openai_stubs }

  describe 'failure scenarios' do
    test 'not authorized to access OpenAI' do
      # Tell webmock to return a 401 by matching the below key.
      judge_judy.llm_key = 'BAD_OPENAI_KEY'
      judge_judy.options = nil # no idea why
      judge_judy.save!

      assert_difference 'book.judgements.count', 1 do
        assert_difference 'book.judgements.where(unrateable: true).count', 1 do
          perform_enqueued_jobs do
            RunJudgeJudyJob.perform_later(book, judge_judy, 1)
          end
        end
      end
    end

    test 'a rating outside the book scale is marked unrateable, not saved out-of-scale' do
      # book's scale is "0,1", but the LLM (ignoring that) returns a 3.
      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .with(headers: { 'Authorization' => "Bearer #{OPENAI_VALID_KEY}" })
        .to_return(
          status:  200,
          body:    { choices: [ { message: { content: '{"judgment": 3, "explanation": "Perfect match"}' } } ] }.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

      assert_difference 'book.judgements.count', 1 do
        assert_difference 'book.judgements.where(unrateable: true).count', 1 do
          perform_enqueued_jobs do
            RunJudgeJudyJob.perform_later(book, judge_judy, 1)
          end
        end
      end

      judgement = book.judgements.order(:id).last
      assert judgement.unrateable
      assert_nil judgement.rating
      assert_match(/outside this book's scale/, judgement.explanation)
    end

    test 'a non-numeric judgment value is marked unrateable, not silently saved as a "0" rating' do
      # book's scale is "0,1" -- 0 is a legitimate value, which is exactly why
      # a garbage judgment silently coercing to 0.0 would otherwise slip past
      # both the blank? check and the out-of-scale check.
      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .with(headers: { 'Authorization' => "Bearer #{OPENAI_VALID_KEY}" })
        .to_return(
          status:  200,
          body:    { choices: [ { message: { content: '{"judgment": "N/A", "explanation": "cannot determine"}' } } ] }.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

      assert_difference 'book.judgements.count', 1 do
        assert_difference 'book.judgements.where(unrateable: true).count', 1 do
          perform_enqueued_jobs do
            RunJudgeJudyJob.perform_later(book, judge_judy, 1)
          end
        end
      end

      judgement = book.judgements.order(:id).last
      assert judgement.unrateable
      assert_nil judgement.rating
    end

    test 'a book with no scale configured has nothing to validate against, so the rating passes through' do
      scaleless_book = Book.create!(name: 'No Scale Book', scale: [])
      scaleless_book.query_doc_pairs.create!(query_text: 'a query', doc_id: 'doc1', document_fields: '{}')

      stub_request(:post, 'https://api.openai.com/v1/chat/completions')
        .with(headers: { 'Authorization' => "Bearer #{OPENAI_VALID_KEY}" })
        .to_return(
          status:  200,
          body:    { choices: [ { message: { content: '{"judgment": 3, "explanation": "Perfect match"}' } } ] }.to_json,
          headers: { 'Content-Type' => 'application/json' }
        )

      perform_enqueued_jobs do
        RunJudgeJudyJob.perform_later(scaleless_book, judge_judy, 1)
      end

      judgement = scaleless_book.judgements.order(:id).last
      assert_not judgement.unrateable
      assert_in_delta(3.0, judgement.rating)
    ensure
      scaleless_book&.really_destroy
    end
  end

  describe '.actively_judging_user_ids' do
    test "finds an ai judge's id even though its GlobalID class segment is AiJudge, not User" do
      SolidQueue::Job.create!(
        active_job_id: SecureRandom.uuid,
        class_name:    'RunJudgeJudyJob',
        queue_name:    'default',
        arguments:     {
          'arguments' => [
            { '_aj_globalid' => book.to_global_id.to_s },
            { '_aj_globalid' => judge_judy.to_global_id.to_s },
            nil
          ],
        }
      )

      assert_includes RunJudgeJudyJob.actively_judging_user_ids(book), judge_judy.id
    end
  end

  describe 'successful judging' do
    test 'judges pair and broadcasts updates' do
      assert_difference 'book.judgements.count', 1 do
        perform_enqueued_jobs do
          RunJudgeJudyJob.perform_later(book, judge_judy, 1)
        end
      end

      judgement = book.judgements.where(user: judge_judy).last
      assert_not_nil judgement
      assert_in_delta(0.0, judgement.rating)
    end

    test 'syncs case ratings per judged pair rather than one bulk update at the end' do
      assert_no_enqueued_jobs(only: UpdateCaseJob) do
        assert_enqueued_with(job: UpdateCaseRatingsJob) do
          RunJudgeJudyJob.new.perform(book, judge_judy, 1)
        end
      end
    end
  end

  describe 'cancellation' do
    test 'stops after saving the provider response when cancellation is requested' do
      job = RunJudgeJudyJob.new(book, judge_judy, nil)
      SolidQueue::Job.create!(
        active_job_id: job.job_id,
        class_name:    'RunJudgeJudyJob',
        queue_name:    'default',
        arguments:     job.serialize
      )
      stub_request(:post, 'https://api.openai.com/v1/chat/completions').to_return do
        RunJudgeJudyJob.cancel(book, judge_judy)
        { status: 200, body: { choices: [ { message: { content: '{"judgment": 0, "explanation": "Current response"}' } } ] }.to_json,
          headers: { 'Content-Type' => 'application/json' } }
      end

      assert_difference 'book.judgements.count', 1 do
        job.perform(book, judge_judy, nil)
      end
      assert_requested :post, 'https://api.openai.com/v1/chat/completions', times: 1
    end

    test 'a tracked job cancelled before execution makes no provider request' do
      job = RunJudgeJudyJob.new
      job.provider_job_id = 999_999_999
      assert_no_difference 'book.judgements.count' do
        job.perform(book, judge_judy, nil)
      end
      assert_not_requested :post, 'https://api.openai.com/v1/chat/completions'
    end

    test 'runs to completion when never tracked by SolidQueue (e.g. inline/test adapter)' do
      job = RunJudgeJudyJob.new
      job.job_id = SecureRandom.uuid

      assert_not SolidQueue::Job.exists?(active_job_id: job.job_id)

      assert_difference 'book.judgements.count', 3 do
        job.perform(book, judge_judy, 3)
      end
    end
  end
end
