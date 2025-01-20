# frozen_string_literal: true

module Api
  module V1
    class CaseScoresController < Api::ApiController
      before_action :set_case
      before_action :check_case

      def_param_group :score_params do
        param :case_score, Hash, required: true do
          param :score, Float
          param :all_rated, [ true, false ]
          param :try_number, Integer
          param :last_try_number, Integer
          param :try_id, Integer
          # this isn't quite right as we have a hash of "query_id" and "values" here'
          param :queries, Hash, required: false do
            param :text, String, desc: 'The actual query text that is being scored.'
            param :score, Float, desc: 'The score.'
            param :maxScore, Float, desc: 'The max possible score'
            param :numFound, Integer, desc: 'How many results matched'
          end
        end
      end

      def index
        @scores = @case.scores.includes(:annotation, :user).limit(10)

        respond_with @scores
      end

      def show
        @score    = @case.scores.first
        @shallow  = false

        respond_with @score
      end

      api :PUT, '/api/cases/:case_id/scores', 'Update a given score for the case.'
      param :case_id, :number,
            desc: 'The ID of the requested case.', required: true
      param_group :score_params
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
