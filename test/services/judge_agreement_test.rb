# frozen_string_literal: true

require 'test_helper'

class JudgeAgreementTest < ActiveSupport::TestCase
  let(:scale) { [ 0, 1, 2, 3 ] }

  # 40 pairs cycling through the scale, the judge's grade from the reference's.
  def cycled count = 40
    (0...count).map { |i| [ i % 4, yield(i % 4) ] }
  end

  test 'perfect agreement' do
    agreement = JudgeAgreement.new(cycled { |grade| grade }, scale: scale)

    assert_in_delta 1.0, agreement.alpha
    assert_in_delta 1.0, agreement.exact_share
    assert_in_delta 1.0, agreement.within_one_share
    assert_in_delta 0.0, agreement.mean_difference
  end

  test 'a judge always one grade lower: within one every time, never exact, and it shows the lean' do
    agreement = JudgeAgreement.new((0...40).map { |i| [ (i % 3) + 1, i % 3 ] }, scale: scale)

    assert_operator agreement.alpha, :<, 1.0
    assert_in_delta 0.0, agreement.exact_share
    assert_in_delta 1.0, agreement.within_one_share
    assert_in_delta(-1.0, agreement.mean_difference)
  end

  test "matches Krippendorff's published binary example (alpha 0.095)" do
    # "Computing Krippendorff's Alpha-Reliability", section A: two observers, ten units.
    a = [ 0, 1, 0, 0, 0, 0, 0, 0, 1, 0 ]
    b = [ 1, 1, 1, 0, 0, 1, 0, 0, 0, 0 ]
    # Ten units is below MIN_PAIRS, so #alpha would withhold it: check the
    # calculation itself.
    assert_in_delta 0.095, JudgeAgreement.new(a.zip(b), scale: [ 0, 1 ]).send(:raw_alpha), 0.0005
  end

  test 'no figure below the minimum overlap' do
    agreement = JudgeAgreement.new(cycled(29) { |grade| grade }, scale: scale)

    assert_not agreement.enough?
    assert_nil agreement.alpha
    assert_in_delta 1.0, agreement.exact_share
  end

  test 'undefined when both judges gave one grade throughout' do
    agreement = JudgeAgreement.new(Array.new(40) { [ 2, 2 ] }, scale: scale)

    assert_nil agreement.alpha
  end

  test 'skips and counts ratings off the scale' do
    ratings = cycled { |grade| grade } + [ [ 1.5, 1 ], [ 2, 7 ] ]
    agreement = JudgeAgreement.new(ratings, scale: scale)

    assert_equal 40, agreement.n
    assert_equal 2, agreement.skipped
  end

  test 'confusion matrix and distributions cover the whole scale' do
    agreement = JudgeAgreement.new([ [ 0, 0 ], [ 0, 1 ], [ 3, 1 ] ], scale: scale)

    assert_equal 16, agreement.confusion.size
    assert_equal 1, agreement.confusion[[ 0.0, 1.0 ]]
    assert_equal 0, agreement.confusion[[ 2.0, 2.0 ]]
    assert_equal({ 0.0 => 2, 1.0 => 0, 2.0 => 0, 3.0 => 1 }, agreement.reference_distribution)
    assert_equal({ 0.0 => 1, 1.0 => 2, 2.0 => 0, 3.0 => 0 }, agreement.judge_distribution)
  end

  test 'nothing to compare' do
    agreement = JudgeAgreement.new([], scale: scale)

    assert_equal 0, agreement.n
    assert_nil agreement.alpha
    assert_nil agreement.exact_share
    assert_nil agreement.mean_difference
  end
end
