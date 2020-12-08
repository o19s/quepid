# frozen_string_literal: true

module Api
  module V1
    module Queries
      class ScorersController < Api::V1::Queries::ApplicationController
        before_action :set_scorer, only: [ :update ]

        def show
          respond_with @query
        end

        def update
          @query.scorer       = @scorer
          @query.scorer_enbl  = true

          if @query.save
            Analytics::Tracker.track_query_scorer_updated_event current_user, @query, @scorer
            respond_with @query
          else
            render json: @query.errors, status: :bad_request
          end
        end

        def destroy
          @query.scorer       = nil
          @query.scorer_enbl  = false

          if @query.save
            Analytics::Tracker.track_query_scorer_deleted_event current_user, @query
            respond_with @query
          else
            render json: @query.errors, status: :bad_request
          end
        end

        private

        def set_scorer
          @scorer = current_user.scorers.where(id: params[:scorer_id]).first
          render json: { error: 'Not Found!' }, status: :not_found unless @scorer
        end
      end
    end
  end
end
