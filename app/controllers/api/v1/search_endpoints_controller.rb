# frozen_string_literal: true

module Api
  module V1
    class SearchEndpointsController < Api::ApiController
      before_action :set_search_endpoint, only: [ :show, :update, :destroy ]

      # rubocop:disable Metrics/MethodLength
      # @tags search endpoints
      # @parameter archived(query) [Boolean] Whether or not to include archived search endpoints.
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

      # @tags search endpoints
      def show
        respond_with @search_endpoint
      end

      # @tags search endpoints
      # @request_body Search endpoint to be created
      #   [
      #     !Hash{
      #       search_endpoint: Hash{
      #         name: String,
      #         search_engine: String,
      #         endpoint_ur: String,
      #         api_method: String,
      #         archived: Boolean,
      #         basic_auth_credential: String,
      #         custom_headers: String,
      #         mapper_code: String,
      #         options: Hash,
      #         proxy_requests: Boolean
      #       }
      #     }
      #   ]
      # @request_body_example basic Solr Search endpoint [Hash]
      #   {
      #     search_endpoint: {
      #       name: "TMDB",
      #       endpoint_url: "https://quepid-solr.dev.o19s.com/solr/tmdb/select",
      #       search_engine: "solr",
      #       api_method: "JSONP"
      #     }
      #   }
      # @request_body_example complete Search endpoint [Hash]
      #   {
      #     search_endpoint: {
      #       name: "LSE",
      #       endpoint_url: "https://www.lse.ac.uk/Search-Results?term=",
      #       search_engine: "searchapi",
      #       api_method: "GET",
      #       basic_auth_credential: "Bob:pass",
      #       custom_headers: "{}",
      #       mapper_code: "console.log('custom javascriptcode');",
      #       options: {},
      #       proxy_requests: true
      #     }
      #   }
      def create
        @search_endpoint = SearchEndpoint.new(search_endpoint_params)
        @search_endpoint.owner = current_user

        if @search_endpoint.save
          respond_with @search_endpoint
        else
          render json: @search_endpoint.errors, status: :bad_request
        end
      end

      # @tags search endpoints
      # @request_body Search endpoint to be created
      #   [
      #     !Hash{
      #       search_endpoint: Hash{
      #         name: String,
      #         search_engine: String,
      #         endpoint_ur: String,
      #         api_method: String,
      #         archived: Boolean,
      #         basic_auth_credential: String,
      #         custom_headers: String,
      #         mapper_code: String,
      #         options: Hash,
      #         proxy_requests: Boolean
      #       }
      #     }
      #   ]
      # @request_body_example basic Search endpoint [Hash]
      #   {
      #     search_endpoint: {
      #       api_method: "GET"
      #     }
      #   }
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

      # @tags search endpoints
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
        params.expect(search_endpoint: [ :api_method, :archived, :basic_auth_credential, :custom_headers,
                                         :endpoint_url, :mapper_code, :name, :proxy_requests, :search_engine,
                                         { options: {} } ])
      end
    end
  end
end
