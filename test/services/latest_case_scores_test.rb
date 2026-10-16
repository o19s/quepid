# frozen_string_literal: true

require 'test_helper'

class LatestCaseScoresTest < ActiveSupport::TestCase
  test 'long histories load only the latest score with timestamp and id tie breakers' do
    first = users(:doug).cases.create!(case_name: 'Long score history')
    second = users(:doug).cases.create!(case_name: 'Other score history')
    empty = users(:doug).cases.create!(case_name: 'No score history')
    older = Time.utc(2020, 1, 1)
    newer = Time.utc(2021, 1, 1)
    Score.insert_all!(Array.new(1000) { { case_id: first.id, score: 0.1, created_at: older, updated_at: older } })
    first.scores.create!(user: users(:doug), score: 0.2, created_at: older, updated_at: newer)
    first.scores.create!(user: users(:doug), score: 0.3, created_at: newer, updated_at: newer)
    winner = first.scores.create!(user: users(:doug), score: 0.4, created_at: newer, updated_at: newer)
    first.scores.create!(score: 0.5, created_at: newer, updated_at: older)
    other = second.scores.create!(score: 0.6)
    records = Case.where(id: [ first.id, second.id, empty.id ]).to_a

    hydrated = 0
    score_sql = nil
    instantiations = ->(*args) { hydrated += args.last[:record_count] if 'Score' == args.last[:class_name] }
    queries = ->(*args) { score_sql = args.last[:sql] if args.last[:sql].match?(/\ASELECT.*FROM [`"]?case_scores/i) }
    ActiveSupport::Notifications.subscribed(instantiations, 'instantiation.active_record') do
      ActiveSupport::Notifications.subscribed(queries, 'sql.active_record') do
        LatestCaseScores.preload(records)
      end
    end

    assert_equal 2, hydrated
    assert_equal winner.id, records.find { |record| record.id == first.id }.last_score.id
    assert_equal other.id, records.find { |record| record.id == second.id }.last_score.id
    assert_nil records.find { |record| record.id == empty.id }.last_score
    records.each do |record|
      assert_predicate record.association(:latest_score), :loaded?
      assert_not record.association(:scores).loaded?
      assert_predicate record.last_score.association(:user), :loaded? if record.last_score
    end

    # Query counts cannot detect a scalar subquery repeated for every history row.
    if ActiveRecord::Base.connection.adapter_name.match?(/mysql/i)
      plan = ActiveRecord::Base.connection.select_value("EXPLAIN FORMAT=JSON #{score_sql}")
      assert_no_match(/"dependent"\s*:\s*true/, plan)
    end
  end

  test 'an empty list does not load any scores' do
    assert_no_queries { LatestCaseScores.preload([]) }
  end
end
