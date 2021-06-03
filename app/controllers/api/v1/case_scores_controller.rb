# frozen_string_literal: true

module Api
  module V1
    class CaseScoresController < Api::ApiController
      before_action :find_case
      before_action :check_case

      def index
        @scores = @case.scores.includes(:annotation, :user).limit(10)

        respond_with @scores
      end

      def update
        service = CaseScoreManager.new @case

        begin
          score_data  = { user_id: current_user.id }.merge(score_params)
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

      def show
        @score    = @case.scores.first
        @shallow  = false

        respond_with @score
      end

      private

      def score_params
        params.require(:case_score).permit(
          :score,
          :all_rated,
          :try_number,
          :try_id,
          queries: [ :text, :score, :maxScore, :numFound ]
        )
      end
    end
  end
end
