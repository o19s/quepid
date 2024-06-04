# frozen_string_literal: true

module Api
  module V1
    # rubocop:disable Metrics/ClassLength
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
      def create
        try_parameters_to_use = try_params

        if params[:parent_try_number] # We need special translation from try_number to the try.id
          try_parameters_to_use[:parent_id] = @case.tries.where(try_number: params[:parent_try_number]).first.id
        end

        @try = @case.tries.build try_parameters_to_use

        # if we are creating a new try with an existing search_endpoint_id,
        # then the params[:search_endpoint] will be empty
        unless params[:search_endpoint].empty?
          search_endpoint_params_to_use = search_endpoint_params
          convert_blank_values_to_nil search_endpoint_params_to_use

          search_endpoint = @current_user.search_endpoints_involved_with.find_by search_endpoint_params_to_use
          if search_endpoint.nil?
            search_endpoint = SearchEndpoint.new search_endpoint_params_to_use
            search_endpoint.owner = @current_user
            search_endpoint.save!
          end

          @try.search_endpoint = search_endpoint
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
      # rubocop:enable Metrics/MethodLength
      # rubocop:enable Metrics/AbcSize

      # rubocop:disable Metrics/MethodLength
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
          respond_with @try
        else
          render json: @try.errors, status: :bad_request
        end
      end
      # rubocop:enable Metrics/MethodLength

      def destroy
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
        params.require(:try).permit(
          :escape_query,
          :field_spec,
          :name,
          :number_of_rows,
          :query_params,
          :parent_id,
          :parent_try_number,
          :search_endpoint_id
        )
      end

      def search_endpoint_params
        # we do not REQUIRE a search_endpoint on a try
        return {} if params[:search_endpoint].nil?

        params.require(:search_endpoint).permit(
          :name,
          :api_method,
          :custom_headers,
          :search_engine,
          :endpoint_url,
          :basic_auth_credential,
          :mapper_code,
          :proxy_requests
        )
      end
    end
    # rubocop:enable Metrics/ClassLength
  end
end
