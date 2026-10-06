# frozen_string_literal: true

require 'test_helper'

class BroadcastJudgeActivityJobTest < ActiveJob::TestCase
  include Turbo::Broadcastable::TestHelper

  let(:book) { books(:james_bond_movies) }
  let(:judge_judy) { users(:judge_judy) }

  test 'replaces cells without replacing the mounted sparkline chart' do
    streams = capture_turbo_stream_broadcasts([ book.owner, book, :judgements ]) do
      BroadcastJudgeActivityJob.perform_now(book, judge_judy)
    end

    assert_equal(%w[replace replace replace], streams.map { |stream| stream['action'] })
    assert_equal([ "judge-status-#{judge_judy.id}", "judge-count-#{judge_judy.id}", "judge-last-#{judge_judy.id}" ],
                 streams.map { |stream| stream['target'] })
  end

  test 'first human judgement adds a row and removes the empty state' do
    book.query_doc_pairs.first.judgements.create!( user: users(:matt), rating: 1)
    streams = capture_turbo_stream_broadcasts([ book.owner, book, :judgements ]) do
      BroadcastJudgeActivityJob.perform_now(book, users(:matt))
    end
    assert_equal 'remove', streams[-2]['action']
    assert_equal 'judge-activity-empty', streams[-2]['target']
    assert_equal 'append', streams.last['action']
    assert_includes streams.last.to_s, "judge-row-#{users(:matt).id}"
  end

  test 'removed human activity removes its row' do
    streams = capture_turbo_stream_broadcasts([ book.owner, book, :judgements ]) do
      BroadcastJudgeActivityJob.perform_now(book, users(:matt))
    end
    assert_equal 'remove', streams.first['action']
  end

  test 'prompt links remain scoped to each viewer when activity is broadcast' do
    judge_judy.teams.clear
    judge_judy.update!(owner: users(:jane))
    streams = capture_turbo_stream_broadcasts([ book.owner, book, :judgements ]) do
      BroadcastJudgeActivityJob.perform_now(book, judge_judy)
    end
    assert_not_includes streams.first.to_s, 'Refine Prompt'
  end
end
