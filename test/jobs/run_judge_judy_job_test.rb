# frozen_string_literal: true

require 'test_helper'

class RunJudgeJudyJobTest < ActiveJob::TestCase
  let(:book) { books(:james_bond_movies) }
  let(:judge_judy) { users(:judge_judy) }

  setup { register_default_openai_stubs }

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
      assert_match(/outside the scale/, judgement.explanation)
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

  describe 'escalation to an on-call judge' do
    # judge_judy's key is refused (401), so every answer it gives is unrateable;
    # the on-call judges below use the valid key and rate 0.
    let(:on_call) do
      AiJudge.create!(name: 'On Call', llm_key: OPENAI_VALID_KEY, system_prompt: judge_judy.system_prompt)
    end

    setup do
      judge_judy.update!(llm_key: 'BAD_OPENAI_KEY', options: nil)
    end

    test 'an unrateable answer wakes the on-call judge, which rates the pair and links back' do
      judge_judy.update!(escalates_to: on_call)

      perform_enqueued_jobs(only: RunJudgeJudyJob) do
        RunJudgeJudyJob.perform_later(book, judge_judy, 1)
      end

      source = book.judgements.find_by!(user: judge_judy)
      escalated = book.judgements.find_by!(user: on_call)
      assert source.unrateable
      assert_equal source, escalated.escalated_from_judgement
      assert_equal source.query_doc_pair, escalated.query_doc_pair
      assert_in_delta(0.0, escalated.rating)
      assert_match(/\AEscalated from Judge Judy, whose answer was unrateable: BOOM/, escalated.explanation)
    end

    test 'wakes nobody when the judge has no on-call judge' do
      RunJudgeJudyJob.new.perform(book, judge_judy, 1)

      assert_no_enqueued_jobs(only: RunJudgeJudyJob)
    end

    test 'wakes nobody when every answer was usable' do
      judge_judy.update!(llm_key: OPENAI_VALID_KEY, escalates_to: on_call)

      RunJudgeJudyJob.new.perform(book, judge_judy, 1)

      assert_no_enqueued_jobs(only: RunJudgeJudyJob)
    end

    test 'the second pass is queued for the on-call judge, under its own lock' do
      judge_judy.update!(escalates_to: on_call)

      assert_enqueued_with(job: RunJudgeJudyJob, args: [ book, on_call, nil, { escalating_from_judge: judge_judy } ]) do
        RunJudgeJudyJob.new.perform(book, judge_judy, 1)
      end
    end

    test 'a pair the on-call judge already judged is skipped, not raised' do
      judge_judy.update!(escalates_to: on_call)
      RunJudgeJudyJob.new.perform(book, judge_judy, 1)
      source = book.judgements.find_by!(user: judge_judy)
      Judgement.create!(query_doc_pair: source.query_doc_pair, user: on_call, rating: 1)

      assert_no_difference 'Judgement.count' do
        RunJudgeJudyJob.new.perform(book, on_call, nil, escalating_from_judge: judge_judy)
      end
    end

    test 'each unrateable answer is escalated once, however often the pass runs' do
      judge_judy.update!(escalates_to: on_call)
      RunJudgeJudyJob.new.perform(book, judge_judy, 2)

      assert_difference 'book.judgements.where(user: on_call).count', 2 do
        RunJudgeJudyJob.new.perform(book, on_call, nil, escalating_from_judge: judge_judy)
      end
      assert_no_difference 'Judgement.count' do
        RunJudgeJudyJob.new.perform(book, on_call, nil, escalating_from_judge: judge_judy)
      end
    end

    test 'an on-call judge that is also unsure wakes the next one down the chain' do
      unsure_on_call = AiJudge.create!(name: 'Unsure On Call', llm_key: 'BAD_OPENAI_KEY',
                                       system_prompt: judge_judy.system_prompt, escalates_to: on_call)
      judge_judy.update!(escalates_to: unsure_on_call)

      perform_enqueued_jobs(only: RunJudgeJudyJob) do
        RunJudgeJudyJob.perform_later(book, judge_judy, 1)
      end

      middle = book.judgements.find_by!(user: unsure_on_call)
      last = book.judgements.find_by!(user: on_call)
      assert middle.unrateable
      assert_equal book.judgements.find_by!(user: judge_judy), middle.escalated_from_judgement
      assert_equal middle, last.escalated_from_judgement
      assert_in_delta(0.0, last.rating)
    end
  end

  describe 'cancellation' do
    test 'stops judging as soon as its SolidQueue job row disappears' do
      # james_bond_movies has 7 query/doc pairs available - plenty of room to
      # prove the loop stops after 1 rather than running out of pairs.
      job = RunJudgeJudyJob.new
      job.job_id = SecureRandom.uuid

      # First call: the initial "am I even tracked by SolidQueue" check (true).
      # Second call: mid-loop check before judging pair 1 (still true).
      # Third call onward: the row has been "cancelled" - stop before pair 2.
      responses = [ true, true, false ]
      call_index = 0
      exists_stub = lambda do |*|
        result = responses[call_index] || false
        call_index += 1
        result
      end

      SolidQueue::Job.singleton_class.send(:alias_method, :exists_without_stub?, :exists?)
      SolidQueue::Job.define_singleton_method(:exists?, exists_stub)

      begin
        assert_difference 'book.judgements.count', 1 do
          job.perform(book, judge_judy, nil)
        end
      ensure
        SolidQueue::Job.singleton_class.send(:alias_method, :exists?, :exists_without_stub?)
        SolidQueue::Job.singleton_class.send(:remove_method, :exists_without_stub?)
      end
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
