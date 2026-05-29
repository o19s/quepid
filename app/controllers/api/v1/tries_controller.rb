# frozen_string_literal: true

module Api
  module V1
    # @tags cases > tries

    class TriesController < Api::ApiController
      before_action :set_case
      before_action :check_case
      before_action :set_try, only: [ :show, :update, :destroy ]

      def index
        @tries = @case.tries
      end

      def show
        respond_with @try
      end

      # @request_body Try to be created [Reference:#/components/schemas/Try]
      # @request_body_example try with existing search endpoint [Reference:#/components/examples/TryWithExistingSearchEndpoint]
      # @request_body_example try creating a new search endpoint [Reference:#/components/examples/TryCreatingNewSearchEndpoint]
      def create
        try_parameters_to_use = try_params

        if params[:parent_try_number]
          # Look up the parent try to maintain the chain of ancestry.
          try_parameters_to_use[:parent_id] = @case.tries.where(try_number: params[:parent_try_number]).first.id
        end

        @try = @case.tries.build try_parameters_to_use # .except(:parent_try_number)

        # Only assign via nested search_endpoint params when they were actually provided.
        # If an existing search_endpoint_id is being used, search_endpoint may be omitted.
        if params[:search_endpoint].present?
          assign_search_endpoint_to_try search_endpoint_params
          return if performed?
        end

        try_number = @case.last_try_number + 1

        @try.try_number       = try_number
        @case.last_try_number = try_number

        # be smart about ancestry tracking leading too long of a string for database column.
        begin
          case_saved = @case.save
        rescue ActiveRecord::ValueTooLong
          @try.parent = nil # restart the ancestry tracking!
          case_saved = @case.save
        end

        if case_saved
          @try.add_curator_vars params[:curator_vars]
          Analytics::Tracker.track_try_saved_event current_user, @try

          respond_with @try
        else
          render json: @try.errors.concat(@case.errors), status: :bad_request
        end
      end

      # @request_body Try to be updated [Reference:#/components/schemas/Try]
      # @request_body_example updating a try
      #   [JSON{
      #     "try": {
      #       "name": "New Name",
      #       "number_of_rows": 3
      #     },
      #     "curator_vars": {},
      #     "search_endpoint": {}
      #   }]
      def update
        assign_search_endpoint_to_try search_endpoint_params unless search_endpoint_params.empty?
        return if performed?

        if @try.update try_params
          respond_with @try
        else
          render json: @try.errors, status: :bad_request
        end
      end

      def destroy
        @try.destroy

        head :no_content
      end

      private

      # Controller-internal: renders :bad_request on save failure. Callers should
      # check Rails' `performed?` after invoking and return early if true.
      def assign_search_endpoint_to_try params_hash
        convert_blank_values_to_nil params_hash
        return if params_hash.blank?

        search_endpoint = SearchEndpoint.find_or_initialize_for_user @current_user, params_hash

        if search_endpoint.new_record?
          save_search_endpoint_or_render_errors search_endpoint
          return if performed?
        elsif search_endpoint.owner_id == @current_user.id
          merge_search_endpoint_updates! search_endpoint, params_hash
          if search_endpoint.changed?
            save_search_endpoint_or_render_errors search_endpoint
            return if performed?
          end
        end

        @try.search_endpoint = search_endpoint
      end

      def merge_search_endpoint_updates! search_endpoint, params_hash
        credential = params_hash.to_h.symbolize_keys[:basic_auth_credential]
        return if credential.blank?
        return if credential == search_endpoint.masked_basic_auth_credential

        search_endpoint.basic_auth_credential = credential
      end

      def save_search_endpoint_or_render_errors search_endpoint
        render json: search_endpoint.errors, status: :bad_request unless search_endpoint.save
      rescue ActiveRecord::Encryption::Errors::Base => e
        Rails.logger.error("Search endpoint encryption error: #{e.message}")
        render json: {
          error: 'Unable to save search endpoint credentials. Check server encryption configuration.',
        }, status: :internal_server_error
      end

      def convert_blank_values_to_nil hash
        hash.each do |key, value|
          if value.is_a?(Hash)
            convert_blank_values_to_nil(value) # Recursively call the method for nested hashes
          elsif value.blank?
            hash[key] = nil
          end
        end
      end

      def set_try
        # We always refer to a try as a incrementing linear number within the scope of
        # a case.   We don't use the internal try_id in the API.
        @try = @case.tries.where(try_number: params[:try_number]).first

        render json: { message: 'Try not found!' }, status: :not_found unless @try
      end

      def try_params
        params.expect(
          try: [ :escape_query,
                 :field_spec,
                 :name,
                 :number_of_rows,
                 :query_params,
                 :parent_id,
                 :search_endpoint_id ]
        )
      end

      def search_endpoint_params
        # we do not REQUIRE a search_endpoint on a try
        return {} if params[:search_endpoint].blank?

        params.expect(
          search_endpoint: [ :name,
                             :api_method,
                             :custom_headers,
                             :search_engine,
                             :endpoint_url,
                             :basic_auth_credential,
                             :mapper_code,
                             :proxy_requests ]
        )
      end
    end
  end
end
