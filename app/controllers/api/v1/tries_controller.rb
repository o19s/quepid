# frozen_string_literal: true

module Api
  module V1
    class TriesController < Api::ApiController
      before_action :find_case
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
        parameters_to_use = try_params
        if params[:parent_try_number] # We need special translation from try_number to the try.id
          parameters_to_use[:parent_id] = @case.tries.where(try_number: params[:parent_try_number]).first.id
        end

        @try = @case.tries.build parameters_to_use

        search_endpoint_params_to_use = search_endpoint_params
        puts 'Here are the search_endpoint_params_to_use'
        # not quite right because it could be via team, needs to be a scope.
        search_endpoint_params_to_use['owner_id'] = @case.owner_id
        puts search_endpoint_params_to_use

        unless search_endpoint_params_to_use['search_engine'].nil?
          search_endpoint = SearchEndpoint.find_or_create_by search_endpoint_params_to_use
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

      def update
        puts "About to look up search end point for #{search_endpoint_params}"
        puts "Is it empty?  #{search_endpoint_params.empty?}"
        #
        # if (search_endpoint_params['endpoint_url'] )
        unless search_endpoint_params.empty?
          search_endpoint = SearchEndpoint.find_or_create_by search_endpoint_params
          puts "Found search end point with id #{search_endpoint.id} and name #{search_endpoint.fullname}"
          @try.search_endpoint = search_endpoint
        end
        # search_endpoint_update =
        if @try.update try_params
          respond_with @try
        else
          render json: @try.errors, status: :bad_request
        end
      end

      def destroy
        @try.destroy

        render json: {}, status: :no_content
      end

      private

      def set_try
        # We always refer to a try as a incrementing linear number within the scope of
        # a case.   We don't use the internal try_id in the API.
        @try = @case.tries.where(try_number: params[:try_number]).first

        render json: { message: 'Try not found!' }, status: :not_found unless @try
      end

      def try_params
        params.require(:try).permit(
          :escape_query,
          # :api_method,
          # :custom_headers,
          :field_spec,
          :name,
          :number_of_rows,
          :query_params,
          # :search_engine,
          # :search_url,
          :parent_id
        )
      end

      def search_endpoint_params
        # params_to_return = params.require(:try).permit(
        params_to_return = params.permit(
          :api_method,
          :custom_headers,
          :search_engine,
          :search_url
        )
        if params_to_return.key? 'search_url'
          # map from the old name to the new name
          params_to_return['endpoint_url'] = params_to_return.delete 'search_url'
        end
        params_to_return
      end
    end
  end
end
