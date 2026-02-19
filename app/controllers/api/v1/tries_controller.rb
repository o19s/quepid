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

      # rubocop:disable Metrics/MethodLength
      # rubocop:disable Metrics/AbcSize
      # rubocop:disable Metrics/PerceivedComplexity
      # @request_body Try to be created [Reference:#/components/schemas/Try]
      # @request_body_example try with existing search endpoint [Reference:#/components/examples/TryWithExistingSearchEndpoint]
      # @request_body_example try creating a new search endpoint [Reference:#/components/examples/TryCreatingNewSearchEndpoint]
      def create
        try_parameters_to_use = params[:try].present? ? try_params.to_h : {}
        parent_try = nil

        if params[:parent_try_number]
          # Look up the parent try to maintain the chain of ancestry.
          parent_try = @case.tries.where(try_number: params[:parent_try_number]).first
          return render(json: { error: 'Parent try not found' }, status: :not_found) if parent_try.nil?

          inherited_try_params = {
            parent_id:          parent_try.id,
            search_endpoint_id: parent_try.search_endpoint_id,
            query_params:       parent_try.query_params,
            field_spec:         parent_try.field_spec,
            escape_query:       parent_try.escape_query,
            number_of_rows:     parent_try.number_of_rows,
          }
          try_parameters_to_use = inherited_try_params.merge(try_parameters_to_use)
        end

        @try = @case.tries.build try_parameters_to_use # .except(:parent_try_number)

        # Apply endpoint override only when search_endpoint is explicitly provided.
        if params.key?(:search_endpoint)
          search_endpoint_params_to_use = search_endpoint_params
          convert_blank_values_to_nil search_endpoint_params_to_use

          unless search_endpoint_params_to_use.empty?
            search_endpoint = @current_user.search_endpoints_involved_with.find_by search_endpoint_params_to_use
            if search_endpoint.nil?
              search_endpoint = SearchEndpoint.new search_endpoint_params_to_use
              search_endpoint.owner = @current_user
              search_endpoint.save!
            end

            @try.search_endpoint = search_endpoint
          end
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
          if params[:curator_vars].present?
            @try.add_curator_vars params[:curator_vars]
          elsif parent_try.present?
            @try.add_curator_vars parent_try.curator_vars_map
          end
          Analytics::Tracker.track_try_saved_event current_user, @try

          respond_with @try
        else
          render json: @try.errors.concat(@case.errors), status: :bad_request
        end
      end
      # rubocop:enable Metrics/MethodLength
      # rubocop:enable Metrics/AbcSize
      # rubocop:enable Metrics/PerceivedComplexity

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
        search_endpoint_params_to_use = search_endpoint_params
        search_endpoint_params_to_use = convert_blank_values_to_nil search_endpoint_params_to_use
        unless search_endpoint_params_to_use.empty?

          # really should be a search_endpoint_id passed in versus all the properties of one!
          search_endpoint = @current_user.search_endpoints_involved_with
            .find_by search_endpoint_params_to_use.except :name

          if search_endpoint.nil?
            search_endpoint = SearchEndpoint.new search_endpoint_params_to_use
            search_endpoint.owner = @current_user
            search_endpoint.save!
          end
          @try.search_endpoint = search_endpoint
        end

        if @try.update try_params
          if params[:curator_vars].present?
            ActiveRecord::Base.transaction do
              @try.curator_variables.destroy_all
              @try.add_curator_vars params[:curator_vars]
            end
          end
          respond_with @try
        else
          render json: @try.errors, status: :bad_request
        end
      end

      def destroy
        return render json: { error: 'Cannot delete the only try in a case' }, status: :unprocessable_content if @case.tries.count <= 1

        @try.destroy

        head :no_content
      end

      private

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
        return {} if params[:search_endpoint].nil?

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
