# frozen_string_literal: true

require 'test_helper'

class RunJudgeJudyJobTest < ActiveJob::TestCase
  let(:book) { books(:james_bond_movies) }
  let(:judge_judy) { users(:judge_judy) }

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
  end
end
