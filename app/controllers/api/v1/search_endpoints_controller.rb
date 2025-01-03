# frozen_string_literal: true

module Api
  module V1
    class SearchEndpointsController < Api::ApiController
      before_action :set_search_endpoint, only: [ :show, :update ]

      def_param_group :search_endpoint_params do
        param :search_endpoint, Hash, required: true do
          param :api_method, String
          param :archived, [ true, false ]
          param :basic_auth_credential, String
          param :custom_headers, String
          param :endpoint_url, String
          param :mapper_code, String
          param :name, String
          param :options, Hash, :desc => 'Additional options accessible by queries through this search endpoint.'
          param :proxy_requests, [ true, false ]
          param :search_engine, String
        end
      end

      # rubocop:disable Metrics/MethodLength
      api :GET, '/api/search_endpoints',
          'List all search endpoints to which the user has access.'
      returns :array_of => :search_endpoint_params, :code => 200, :desc => 'All search endpoints'
      error :code => 401, :desc => 'Unauthorized'
      param :archived, [ true, false ],
            :desc          => 'Whether or not to include archived cases in the response.',
            :required      => false,
            :default_value => false
      def index
        archived = deserialize_bool_param(params[:archived])

        current_user.search_endpoints_involved_with

        @search_endpoints = if params[:team_id]
                              current_user.search_endpoints_involved_with
                                .where(archived: archived)
                                .joins(:teams).where(teams: { id: params[:team_id] })
                            elsif params[:case_id]
                              set_case # inherited
                              current_user.search_endpoints_involved_with
                                .where(archived: archived)
                                .joins(:teams).where(teams: { id: @case.teams.pluck(:id) })
                            else
                              current_user.search_endpoints_involved_with
                                .where(archived: archived)
                            end

        respond_with @search_endpoints
      end
      # rubocop:enable Metrics/MethodLength

      api :GET, '/api/search_endpoints/:search_endpoint_id',
          'Show the search endpoint with the given ID.'
      param :search_endpoint_id, :number,
            desc: 'The ID of the requested search endpoint.', required: true
      def show
        respond_with @search_endpoint
      end

      api :POST, '/api/search_endpoints', 'Create a search endpoint.'
      param_group :search_endpoint_params
      def create
        @search_endpoint = current_user.search_endpoints.build search_endpoint_params

        if @search_endpoint.save
          respond_with @search_endpoint
        else
          render json: @search_endpoint.errors, status: :bad_request
        end
      end

      api :PUT, '/api/search_endpoints/:search_endpoint_id', 'Update a given search endpoint.'
      param :search_endpoint_id, :number,
            desc: 'The ID of the requested search endpoint.', required: true
      param_group :search_endpoint_params
      def update
        update_params = search_endpoint_params
        archived = deserialize_bool_param(params[:archived])
        if archived
          # archiving a case means current user takes it over, that should be better expressed.
          @search_endpoint.owner = current_user
          @search_endpoint.mark_archived!
          respond_with @search_endpoint
        elsif @search_endpoint.update update_params
          respond_with @search_endpoint
        else
          render json: @search_endpoint.errors, status: :bad_request
        end
      end

      api :DELETE, '/api/search_endpoint/:search_endpoint_id', 'Delete a given search endpoint.'
      param :search_endpoint_id, :number,
            desc: 'The ID of the requested search endpoint.', required: true
      def destroy
        @search_endpoint.destroy

        head :no_content
      end

      private

      def set_search_endpoint
        # This block of logic should all be in user_search_endpoint_finder.rb
        @search_endpoint = current_user.search_endpoints_involved_with.where(id: params[:id]).first

        render json: { error: 'Not Found!' }, status: :not_found unless @search_endpoint
      end

      def search_endpoint_params
        params.require(:search_endpoint).permit(:api_method, :archived, :basic_auth_credential, :custom_headers,
                                                :endpoint_url, :mapper_code, :name, :proxy_requests, :search_engine,
                                                options: {})
      end
    end
  end
end
