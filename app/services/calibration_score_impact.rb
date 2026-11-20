# frozen_string_literal: true

# How a judge's grades would move per-query scores compared with the
# reference's: the "ranks agreement" view of a query-sampled calibration
# (docs/todo/judge_calibration.md C6). Each query's top list is scored with
# nDCG@10 in the order the search returned it, once with each judge's grades,
# so a disagreement at rank 1 counts for more than one at rank 9 -- as it
# does in a case's score.
#
#   impact = CalibrationScoreImpact.new([ { query_text:, position:, reference:, judge: }, ... ])
#   impact.queries        # per query: reference and judge nDCG@10, and the difference
#   impact.kendall_tau    # do both rank the queries, easiest to hardest, the same way?
#
# A query is compared only when the judge graded its whole list: an
# unrateable answer leaves a hole that would change the score by itself.
class CalibrationScoreImpact
  # Fewer compared queries than this say too little about score impact.
  MIN_QUERIES = 10
  DEPTH = 10
  # A difference in nDCG@10 big enough to notice on a case.
  BIG_SHIFT = 0.1

  Query = Struct.new(:query_text, :reference_score, :judge_score) do
    def difference
      judge_score - reference_score
    end
  end

  attr_reader :queries, :incomplete

  # @param rows [Array<Hash>] one per pair: :query_text, :position, :reference
  #   (grade) and :judge (grade, or nil when it gave none)
  def initialize rows
    lists = rows.group_by { |row| row[:query_text] }
    complete, partial = lists.partition { |_, list| list.all? { |row| !row[:judge].nil? } }
    @incomplete = partial.size
    @queries = complete.map do |query_text, list|
      ordered = list.sort_by { |row| row[:position] }.first(DEPTH)
      Query.new(query_text, ndcg(ordered.map { |row| row[:reference].to_f }), ndcg(ordered.map { |row| row[:judge].to_f }))
    end
  end

  def n
    queries.size
  end

  def enough?
    n >= MIN_QUERIES
  end

  def mean_absolute_difference
    return nil if n.zero?

    queries.sum { |query| query.difference.abs } / n
  end

  # Positive: the judge scores the search higher than the reference does.
  def mean_difference
    return nil if n.zero?

    queries.sum(&:difference) / n
  end

  def big_shifts
    queries.count { |query| query.difference.abs >= BIG_SHIFT }
  end

  def largest_shift
    queries.map { |query| query.difference.abs }.max
  end

  # Kendall's tau-b between the two judges' per-query scores: 1 when they
  # order the queries the same way, 0 when unrelated. nil below MIN_QUERIES,
  # or when either judge scored every query the same.
  def kendall_tau
    return nil unless enough?

    concordant = discordant = tied_reference = tied_judge = 0
    queries.combination(2) do |first, second|
      reference_order = first.reference_score <=> second.reference_score
      judge_order = first.judge_score <=> second.judge_score
      if reference_order.zero? && judge_order.zero?
        next
      elsif reference_order.zero?
        tied_reference += 1
      elsif judge_order.zero?
        tied_judge += 1
      elsif reference_order == judge_order
        concordant += 1
      else
        discordant += 1
      end
    end
    denominator = Math.sqrt((concordant + discordant + tied_reference) * (concordant + discordant + tied_judge))
    denominator.zero? ? nil : (concordant - discordant) / denominator
  end

  private

  # nDCG with linear gain: the list's DCG over the DCG of the same grades in
  # the best order. A list with no relevant document scores 0.
  def ndcg grades
    ideal = dcg(grades.sort.reverse)
    ideal.zero? ? 0.0 : dcg(grades) / ideal
  end

  def dcg grades
    grades.each_with_index.sum { |grade, index| grade / Math.log2(index + 2) }
  end
end
