# frozen_string_literal: true

module Api
  module V1
    class CaseScoresController < Api::ApiController
      before_action :find_case
      before_action :check_case

      def index
        @scores = @case.scores.includes(:annotation).limit(10)

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

      # There is a weird thing where for some reason our params object has both
      # a "score" and a "case_score" hash of params, and they are identical, even
      # though the front end only submits a "score" hash.  Some sort of magic.
      # this leads to a Unpermitted parameter: queries
      def score_params
        params.require(:case_score).permit(
          :score,
          :all_rated,
          :try_id
        ).tap do |whitelisted|
          whitelisted[:queries] = params[:case_score][:queries] if params[:case_score][:queries]
        end
      end
    end
  end
end
