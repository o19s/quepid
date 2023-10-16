# frozen_string_literal: true

module Api
  module V1
    class SearchEndpointsController < Api::ApiController
      before_action :set_search_endpoint, only: [ :show, :update ]
      def index
        bool = ActiveRecord::Type::Boolean.new
        archived = bool.deserialize params[:archived] || false

        current_user.search_endpoints_involved_with

        @search_endpoints = if params[:team_id]
                              current_user.search_endpoints_involved_with
                                .where(archived: archived)
                                .joins(:teams).where(teams: { id: params[:team_id] })
                            else
                              current_user.search_endpoints_involved_with
                                .where(archived: archived)
                            end

        respond_with @search_endpoints
      end

      def show
        respond_with @search_endpoint
      end

      def update
        update_params = search_endpoint_params
        bool = ActiveRecord::Type::Boolean.new
        archived = bool.deserialize(update_params[:archived]) || false
        if archived
          # archiving a case means current user takes it over, that should be better expressed.
          @search_endpoint.owner = current_user
          @search_endpoint.mark_archived!
          # Analytics::Tracker.track_case_archived_event current_user, @case
          respond_with @search_endpoint
        elsif @search_endpoint.update update_params
          # Analytics::Tracker.track_case_updated_event current_user, @case
          respond_with @search_endpoint
        else
          render json: @search_endpoint.errors, status: :bad_request
        end
      end

      private

      def set_search_endpoint
        # This block of logic should all be in user_search_endpoint_finder.rb
        @search_endpoint = current_user.search_endpoints_involved_with.where(id: params[:id]).first

        render json: { error: 'Not Found!' }, status: :not_found unless @search_endpoint
      end

      def search_endpoint_params
        params.require(:search_endpoint).permit(:archived)
      end
    end
  end
end
