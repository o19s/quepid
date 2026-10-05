# frozen_string_literal: true

require 'test_helper'

class CalibrationScoreImpactTest < ActiveSupport::TestCase
  # One query's list: grades in rank order, for both judges.
  def list query_text, reference, judge
    reference.each_with_index.map do |grade, position|
      { query_text: query_text, position: position, reference: grade, judge: judge[position] }
    end
  end

  test 'scores each query with nDCG@10 in the order the search returned it' do
    impact = CalibrationScoreImpact.new(list('q', [ 0, 1 ], [ 1, 0 ]))
    query = impact.queries.first

    # Reference: the relevant doc at rank 2, so DCG 1/log2(3) over an ideal of 1.
    assert_in_delta 1 / Math.log2(3), query.reference_score
    assert_in_delta 1.0, query.judge_score
    assert_in_delta 1.0 - (1 / Math.log2(3)), query.difference
  end

  test 'a list with nothing relevant scores 0' do
    assert_in_delta 0.0, CalibrationScoreImpact.new(list('q', [ 0, 0 ], [ 0, 0 ])).queries.first.reference_score
  end

  test 'leaves out a query with an unrateable answer, and counts it' do
    impact = CalibrationScoreImpact.new(list('whole', [ 1, 0 ], [ 1, 0 ]) + list('holed', [ 1, 0 ], [ 1, nil ]))

    assert_equal [ 'whole' ], impact.queries.map(&:query_text)
    assert_equal 1, impact.incomplete
  end

  test 'only the top ten count' do
    impact = CalibrationScoreImpact.new(list('q', [ 1 ] + Array.new(10, 0), [ 1 ] + Array.new(9, 0) + [ 1 ]))

    assert_in_delta 0.0, impact.queries.first.difference
  end

  describe 'across queries' do
    # Queries of increasing difficulty: the relevant document drops one rank each time.
    def ladder count, &judge_rank
      (0...count).flat_map do |i|
        reference = Array.new(10, 0).tap { |grades| grades[i % 10] = 1 }
        judge = Array.new(10, 0).tap { |grades| grades[judge_rank.call(i) % 10] = 1 }
        list("q#{i}", reference, judge)
      end
    end

    test 'the same order of queries: tau 1, no shift' do
      impact = CalibrationScoreImpact.new(ladder(10) { |i| i })

      assert_predicate impact, :enough?
      assert_in_delta 1.0, impact.kendall_tau
      assert_in_delta 0.0, impact.mean_absolute_difference
      assert_equal 0, impact.big_shifts
    end

    test 'the reverse order: tau -1, with the shifts and lean counted' do
      impact = CalibrationScoreImpact.new(ladder(10) { |i| 9 - i })

      assert_in_delta(-1.0, impact.kendall_tau)
      assert_operator impact.big_shifts, :>, 0
      assert_in_delta 0.0, impact.mean_difference, 1e-9
    end

    test 'no tau below the minimum number of queries' do
      impact = CalibrationScoreImpact.new(ladder(9) { |i| i })

      assert_not impact.enough?
      assert_nil impact.kendall_tau
    end
  end
end
