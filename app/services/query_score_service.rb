# frozen_string_literal: true

# Scores a single query using the case's scorer and the query's existing ratings.
# Does NOT re-fetch from the search engine — uses only the persisted ratings.
# This enables near-instant feedback after a rating change.
#
# @see FetchService#score_snapshot for the full (snapshot-based) scoring path
# @see JavascriptScorer for the V8/MiniRacer execution engine
class QueryScoreService
  # @param query [Query] The query to score
  # @param scorer [Scorer] The scorer with JS code and scale
  # @return [Float, nil] The computed score, or nil if scoring fails
  def self.score query, scorer
    return nil if scorer.blank? || scorer.code.blank?

    # Build the docs array: we don't have snapshot docs, so we build a minimal
    # array from the query's ratings (same shape JavascriptScorer expects).
    # In the full flow, docs come from snapshot_docs with merged ratings.
    # Here we only have rated docs, which is sufficient for most scorers.
    doc_ratings = {}
    query.ratings.each do |rating|
      doc_ratings[rating.doc_id] = rating.rating
    end

    # docs: array of rated docs in no particular order (scorers that need
    # position info won't work without a search, but most only need ratings)
    docs = query.ratings.map do |rating|
      { id: rating.doc_id, rating: rating.rating }
    end

    # best_docs: all rated docs, sorted by rating descending
    best_docs = docs.sort_by { |d| -(d[:rating] || 0) }

    javascript_scorer = JavascriptScorer.new(Rails.root.join('lib/scorer_logic.js'))
    score = javascript_scorer.score(docs, best_docs, scorer.code.dup)

    score = 0 if score.is_a?(Float) && score.nan?
    score
  rescue JavascriptScorer::ScoreError => e
    Rails.logger.warn("QueryScoreService: scoring failed for query #{query.id}: #{e.message}")
    nil
  end
end
