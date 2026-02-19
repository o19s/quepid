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
          return render(json: { error: 'No scorer configured' }, status: :unprocessable_content) unless scorer

          score = QueryScoreService.score(query, scorer)

          render json: {
            query_id:  query.id,
            score:     score,
            max_score: scorer.scale&.last,
          }
        end
      end
    end
  end
end
