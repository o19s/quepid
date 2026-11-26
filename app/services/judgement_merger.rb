# frozen_string_literal: true

# Turns the rateable judgements on one query/doc pair into the rating a case reads.
# One merger per book: the book decides how its judgements are merged
# (docs/adr/0007-configurable-judgement-merging.md).
class JudgementMerger
  def initialize book
    @book = book
  end

  # @param judgements [Enumerable<Judgement>] rateable judgements on one query/doc pair
  # @return [Numeric, nil] the merged rating, or nil when there is nothing to merge
  def rating_for judgements
    ratings = judgements.map(&:rating)
    return nil if ratings.empty?

    fit_to_scale(quepid_classic(ratings))
  end

  private

  # Optimistic-pessimistic merge:
  # 1. With only 1-2 judgements, average them (not enough data for consensus).
  # 2. Otherwise take the three highest ratings (assume the best judges rated highest).
  # 3. If those agree, use that value; if not, use their minimum (assume judges overrate).
  def quepid_classic ratings
    ratings = ratings.sort.reverse
    return ratings.sum / ratings.size if ratings.size < 3

    ratings.first(3).min
  end

  # Explicit judgements only work with integers; implicit judgements keep the float.
  def fit_to_scale rating
    @book.support_implicit_judgements? ? rating : rating.round
  end
end
