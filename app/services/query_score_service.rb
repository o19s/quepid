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

    docs = build_docs query

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

  def self.build_docs query
    docs = []
    ratings_by_doc_id = query.ratings.to_h { |rating| [ rating.doc_id.to_s, rating.rating ] }
    seen_doc_ids = {}

    latest_snapshot_query_for(query)&.snapshot_docs&.each do |snapshot_doc|
      doc_id = snapshot_doc.doc_id.to_s
      docs << {
        id:       snapshot_doc.doc_id,
        rating:   ratings_by_doc_id[doc_id],
        position: snapshot_doc.position,
      }
      seen_doc_ids[doc_id] = true
    end

    # Include rated docs not present in the latest snapshot ordering.
    next_position = docs.size + 1
    ratings_by_doc_id.each do |doc_id, rating|
      next if seen_doc_ids[doc_id]

      docs << { id: doc_id, rating: rating, position: next_position }
      next_position += 1
    end

    docs
  end
  private_class_method :build_docs

  def self.latest_snapshot_query_for query
    query.snapshot_queries
      .joins(:snapshot)
      .where(snapshots: { case_id: query.case_id })
      .includes(:snapshot_docs)
      .order('snapshots.created_at DESC')
      .first
  end
  private_class_method :latest_snapshot_query_for
end
