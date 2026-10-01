# frozen_string_literal: true

require 'test_helper'

class BroadcastJudgeActivityJobTest < ActiveJob::TestCase
  include Turbo::Broadcastable::TestHelper

  let(:book) { books(:james_bond_movies) }
  let(:judge_judy) { users(:judge_judy) }

  test 'replaces just that judge row when it already exists' do
    streams = capture_turbo_stream_broadcasts(book.judgements_broadcast_channel) do
      BroadcastJudgeActivityJob.perform_now(book, judge_judy)
    end

    assert_equal 1, streams.size
    assert_equal 'replace', streams.first['action']
    assert_equal "judge-row-#{judge_judy.id}", streams.first['target']
  end

  # This is the scenario the whole-table fallback exists for: a per-row
  # "replace" would silently no-op here since no #judge-row-<id> element
  # exists yet anywhere - updating the whole (always-present) tbody instead
  # means a book's very first activity still shows up live.
  test 'falls back to a whole-table update for a book with no prior judging activity' do
    empty_book = books(:empty_book)

    streams = capture_turbo_stream_broadcasts(empty_book.judgements_broadcast_channel) do
      BroadcastJudgeActivityJob.perform_now(empty_book, judge_judy)
    end

    assert_equal 1, streams.size
    assert_equal 'update', streams.first['action']
    assert_equal 'judge-activity-table', streams.first['target']
  end
end
