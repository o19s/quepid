# frozen_string_literal: true

require 'test_helper'

class BroadcastJudgeActivityJobTest < ActiveJob::TestCase
  let(:book) { books(:james_bond_movies) }
  let(:judge_judy) { users(:judge_judy) }

  test 'broadcasts a refresh of the whole judge activity table' do
    assert_nothing_raised do
      BroadcastJudgeActivityJob.perform_now(book, judge_judy)
    end
  end

  # This is the scenario the whole-table refresh exists for: a per-row
  # "replace" would silently no-op here since no #judge-row-<id> element
  # exists yet anywhere - updating the whole (always-present) tbody instead
  # means a book's very first activity still shows up live.
  test 'broadcasts successfully for a book with no prior judging activity' do
    empty_book = books(:empty_book)

    assert_nothing_raised do
      BroadcastJudgeActivityJob.perform_now(empty_book, judge_judy)
    end
  end
end
