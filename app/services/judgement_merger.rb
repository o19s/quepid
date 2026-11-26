# frozen_string_literal: true

# Turns the rateable judgements on one query/doc pair into the rating a case reads,
# in three steps the book configures (docs/adr/0007-configurable-judgement-merging.md):
# select the judgements that count, combine their ratings, fit the result to the scale.
class JudgementMerger
  def initialize book
    @book = book
  end

  # @param judgements [Enumerable<Judgement>] rateable judgements on one query/doc pair
  # @return [Numeric, nil] the merged rating, or nil when there is nothing to merge
  def rating_for judgements
    # Oldest judgement first, which only the 'first' rule cares about.
    ratings = select_tier(judgements).sort_by { |judgement| [ judgement.created_at.to_f, judgement.id.to_i ] }.map(&:rating)
    return nil if ratings.empty?

    fit_to_scale(combine(ratings))
  end

  private

  # Only the first tier that has any judgements counts; lower tiers are ignored for this
  # pair, not deleted. Judge kinds the book does not list form an implicit last tier.
  def select_tier judgements
    by_kind = judgements.group_by(&:judge_kind)
    first_tier = Array(@book.judgement_merge_tiers).find { |kind| by_kind.key?(kind) }
    first_tier ? by_kind[first_tier] : judgements
  end

  def combine ratings
    case @book.judgement_merge_rule
    when 'mean' then ratings.sum / ratings.size
    when 'median' then median(ratings)
    when 'min' then ratings.min
    when 'max' then ratings.max
    when 'majority' then majority(ratings)
    when 'first' then ratings.first
    else quepid_classic(ratings)
    end
  end

  def median ratings
    sorted = ratings.sort
    middle = sorted.size / 2
    sorted.size.odd? ? sorted[middle] : (sorted[middle - 1] + sorted[middle]) / 2.0
  end

  # The most common rating; a tie between the most common ones falls back to the median.
  def majority ratings
    counts = ratings.tally
    winners = counts.select { |_rating, count| count == counts.values.max }.keys
    winners.one? ? winners.first : median(ratings)
  end

  # Optimistic-pessimistic merge:
  # 1. With only 1-2 judgements, average them (not enough data for consensus).
  # 2. Otherwise take the three highest ratings (assume the best judges rated highest).
  # 3. If those agree, use that value; if not, use their minimum (assume judges overrate).
  def quepid_classic ratings
    ratings = ratings.sort.reverse
    return ratings.sum / ratings.size if ratings.size < 3

    ratings.first(3).min
  end

  # Explicit judgements are scale values, so a merged rating between two of them snaps to the
  # nearest one; implicit judgements keep the float. A book without a scale, or a rating outside
  # the scale (from judgements that were already off it), rounds as before.
  def fit_to_scale rating
    return rating if @book.support_implicit_judgements?
    return rating.round if scale.empty? || !rating.between?(scale.values.min, scale.values.max)

    scale.nearest(rating)
  end

  def scale
    @scale ||= JudgeScale.for(@book)
  end
end
