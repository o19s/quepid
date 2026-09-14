# frozen_string_literal: true

require 'test_helper'

class BroadcastJudgeActivityJobTest < ActiveJob::TestCase
  let(:book) { books(:james_bond_movies) }
  let(:judge_judy) { users(:judge_judy) }

  test 'broadcasts judge activity row successfully' do
    assert_nothing_raised do
      BroadcastJudgeActivityJob.perform_now(book, judge_judy)
    end
  end

  test 'supports explicit actively_judging override' do
    assert_nothing_raised do
      BroadcastJudgeActivityJob.perform_now(book, judge_judy, actively_judging: false)
    end
  end
end
