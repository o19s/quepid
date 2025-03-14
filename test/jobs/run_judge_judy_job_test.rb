# frozen_string_literal: true

require 'test_helper'

class RunJudgeJudyJobTest < ActiveJob::TestCase
  let(:book) { books(:james_bond_movies) }
  let(:judge_judy) { users(:judge_judy) }

  describe 'failure scenarios' do
    test 'not authorized to access OpenAI' do
      # Tell webmock to return a 401 by matching the below key.
      judge_judy.openai_key = 'BAD_OPENAI_KEY'
      judge_judy.options = nil # no idea why
      judge_judy.save!

      assert_no_difference 'book.judgements.count' do
        perform_enqueued_jobs do
          assert_raises(RuntimeError, '401 -') do
            RunJudgeJudyJob.perform_later(book, judge_judy, 1)
          end
        end
      end
    end

    test 'could not rate query_doc_pair, marks it as later' do
      puts "Please don't forget to do this one."
      assert true
    end
  end
end
