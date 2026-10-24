# frozen_string_literal: true

# How well two judges agree on the pairs both rated
# (docs/todo/judge_agreement_and_calibration.md D1, D3, D4).
#
#   agreement = JudgeAgreement.new([ [ reference_rating, judge_rating ], ... ], scale: [ 0, 1, 2, 3 ])
#   agreement.alpha # => 0.61, or nil below MIN_PAIRS or when it's undefined
#
# The headline is Krippendorff's alpha with the ordinal metric: chance-corrected
# like Cohen's kappa, and a 0-vs-3 disagreement costs more than 0-vs-1. Beside it,
# the plain exact and within-one-grade shares, the mean signed difference (which
# way the judge leans), and the confusion matrix. Ratings off the scale are
# skipped and counted rather than rounded (D2).
class JudgeAgreement
  # Below this many compared pairs alpha swings too much to mean anything (D4).
  MIN_PAIRS = 30

  attr_reader :scale, :pairs, :skipped

  # @param ratings [Array<Array(Numeric, Numeric)>] [reference, judge] per pair
  # @param scale [Array<Numeric>] the book's scale, in order
  def initialize ratings, scale:
    @scale = scale.map(&:to_f)
    @index = @scale.each_with_index.to_h
    @pairs, off_scale = ratings.partition { |a, b| @index.key?(a.to_f) && @index.key?(b.to_f) }
    @pairs = @pairs.map { |a, b| [ a.to_f, b.to_f ] }
    @skipped = off_scale.size
  end

  def n
    pairs.size
  end

  def enough?
    n >= MIN_PAIRS
  end

  # nil below MIN_PAIRS, and when undefined: both judges gave one and the same
  # grade throughout, so there's no variation to agree about.
  def alpha
    enough? ? raw_alpha : nil
  end

  def exact_share
    share { |a, b| a == b }
  end

  def within_one_share
    share { |a, b| (@index[a] - @index[b]).abs <= 1 }
  end

  # Judge minus reference, averaged over the pairs: negative means the judge
  # rates lower.
  def mean_difference
    return nil if n.zero?

    pairs.sum { |a, b| b - a } / n
  end

  # { [reference_grade, judge_grade] => count } for every combination on the scale.
  def confusion
    counts = scale.product(scale).index_with { 0 }
    pairs.each { |a, b| counts[[ a, b ]] += 1 }
    counts
  end

  def reference_distribution
    distribution(pairs.map(&:first))
  end

  def judge_distribution
    distribution(pairs.map(&:last))
  end

  private

  def share(&)
    return nil if n.zero?

    pairs.count(&).fdiv(n)
  end

  def distribution values
    counts = scale.index_with { 0 }
    values.each { |value| counts[value] += 1 }
    counts
  end

  # Krippendorff, "Computing Krippendorff's Alpha-Reliability": every pair is a
  # unit with two values, so each adds to the coincidence matrix both ways.
  # alpha = 1 - (total - 1) * sum(o_ck * d_ck) / sum(n_c * n_k * d_ck)
  def raw_alpha
    size = scale.size
    coincidences = Array.new(size) { Array.new(size, 0) }
    pairs.each do |a, b|
      coincidences[@index[a]][@index[b]] += 1
      coincidences[@index[b]][@index[a]] += 1
    end
    marginals = coincidences.map(&:sum)
    total = marginals.sum

    observed = 0.0
    expected = 0.0
    size.times do |c|
      size.times do |k|
        distance = ordinal_distance(marginals, c, k)
        observed += coincidences[c][k] * distance
        expected += marginals[c] * marginals[k] * distance
      end
    end
    return nil if expected.zero?

    1 - ((total - 1) * observed / expected)
  end

  # The ordinal metric: how many values lie between two grades, counting each
  # end grade half.
  def ordinal_distance marginals, first, second
    low, high = [ first, second ].minmax
    (marginals[low..high].sum - ((marginals[first] + marginals[second]) / 2.0))**2
  end
end
