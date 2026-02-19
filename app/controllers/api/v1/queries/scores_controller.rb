# frozen_string_literal: true

module Api
  module V1
    module Queries
      # Lightweight single-query scoring endpoint. Scores a query from its
      # existing ratings using the case's scorer, without re-running search.
      # Returns the score immediately for fast UI updates after rating changes.
      #
      # POST /api/v1/cases/:case_id/queries/:query_id/score
      class ScoresController < Api::ApiController
        before_action :set_case
        before_action :check_case

        def create
          query = @case.queries.find_by(id: params[:query_id])
          return render(json: { error: 'Query not found' }, status: :not_found) unless query

          scorer = @case.scorer
          unless scorer
            return render json: {
              query_id:        query.id,
              score:           fallback_score_for(query),
              max_score:       nil,
              fallback:        true,
              fallback_reason: 'no_scorer_configured',
            }
          end

          computed_score = QueryScoreService.score(query, scorer)
          used_fallback = computed_score.nil?
          score = used_fallback ? fallback_score_for(query) : computed_score

          render json: {
            query_id:        query.id,
            score:           score,
            max_score:       scorer.scale&.last,
            fallback:        used_fallback,
            fallback_reason: used_fallback ? 'lightweight_score_unavailable' : nil,
          }
        end

        private

        def fallback_score_for query
          queries = @case.last_score&.queries
          return '?' unless queries.is_a?(Hash)

          entry = queries[query.id.to_s] || queries[query.id]
          if entry.is_a?(Hash)
            entry['score'] || entry[:score] || '?'
          else
            entry || '?'
          end
        end
      end
    end
  end
end
