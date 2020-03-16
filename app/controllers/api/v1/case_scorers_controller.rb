# frozen_string_literal: true

module Api
  module V1
    class CaseScorersController < Api::ApiController
      before_action :find_case
      before_action :check_case

      def index
        @default           = @case.scorer
        @user_scorers      = @case.user_scorers
        @default_scorers   = @case.default_scorers

        respond_with @user_scorers, @default_scorers, @default
      end

      def update
        scorer_id   = params[:id]
        scorer_type = params[:scorer_type] || 'Scorer'

        if scorer_removed?
          scorer_id   = nil
          scorer_type = nil
        end

        if @case.update scorer_id: scorer_id, scorer_type: scorer_type
          Analytics::Tracker.track_case_updated_event current_user, @case
          respond_with @case
        else
          render json: @case.errors, status: :bad_request
        end
      rescue ActiveRecord::InvalidForeignKey
        render json: { error: 'Invalid id' }, status: :bad_request
      end

      private

      def scorer_removed?
        [ 0, '0' ].include?(params[:id])
      end
    end
  end
end
