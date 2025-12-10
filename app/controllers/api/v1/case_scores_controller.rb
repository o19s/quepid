# frozen_string_literal: true

module Api
  module V1
    # @tags cases > scores
    class CaseScoresController < Api::ApiController
      before_action :set_case
      before_action :check_case

      def index
        @scores = @case.scores.where(scorer: @case.scorer).includes(:user).limit(10)
        respond_with @scores
      end

      # @summary Most recent case score
      # > Returns the most recent score for the case.
      def show
        @score    = @case.scores.first
        @shallow  = false

        unless @score
          head :no_content
          return
        end

        respond_with @score
      end

      # @request_body Score to be created
      #   [
      #     !Hash{
      #       case_score: Hash{
      #         score: Float,
      #         all_rated: Boolean,
      #         try_number: Integer,
      #         last_try_number: Integer,
      #         try_id: Integer,
      #         queries: Hash{
      #           query_id: Hash{
      #             text: String,
      #             score: Float
      #             maxScore: Float,
      #             numFound: Integer
      #           }
      #         }
      #       }
      #     }
      #   ]
      # @request_body_example basic score
      #   [JSON{
      #     "case_score": {
      #       "score": 0.4
      #     }
      #   }]
      # @request_body_example complete score
      #   [JSON{
      #     "case_score": {
      #       "score": 0.98,
      #       "all_rated": false,
      #       "try_number": 42,
      #       "queries": {
      #         "1":{"text":"first query", "score": 1},
      #         "2":{"text":"second query", "score": 0.96}
      #       }
      #     }
      #   }]
      def update
        service = CaseScoreManager.new @case

        begin
          scorer_id = @case.scorer.presence&.id
          score_data  = { user_id: current_user.id, scorer_id: scorer_id }.merge(score_params)
          @score      = service.update score_data

          unless @score
            head :no_content
            return
          end

          respond_with @score
        rescue ActiveRecord::RecordInvalid
          render json: service.errors, status: :bad_request
        end
      end

      private

      # rubocop:disable Rails/StrongParametersExpect
      # tried to migrate and had no love.
      def score_params
        params.require(:case_score).permit(
          :score,
          :all_rated,
          :try_number,
          :try_id,
          queries: [ :text, :score, :maxScore, :numFound ]
        )
      end
      # rubocop:enable Rails/StrongParametersExpect
    end
  end
end
