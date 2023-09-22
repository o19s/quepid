# frozen_string_literal: true

module Api
  module V1
    class SearchEndpointsController < Api::ApiController
      before_action :set_search_endpoint, only: [ :show ]
      def index
        @search_endpoints = current_user.search_endpoints_involved_with
        respond_with @search_endpoints
      end

      def show
        @shallow = params[:shallow] || false
        respond_with @search_endpoint
      end

      private

      def set_search_endpoint
        # This block of logic should all be in user_search_endpoint_finder.rb
        @search_endpoint = current_user.search_endpoints_involved_with.where(id: params[:id]).first

        render json: { error: 'Not Found!' }, status: :not_found unless @search_endpoint
      end
    end
  end
end
