# frozen_string_literal: true

module Api
  module V1
    module Clone
      class TriesController < Api::ApiController
        before_action :find_case
        before_action :check_case
        before_action :set_try, only: [ :create ]

        # rubocop:disable Metrics/MethodLength
        def create
          new_try_params = {
            escapeQuery:    @try.escapeQuery,
            fieldSpec:      @try.fieldSpec,
            number_of_rows: @try.number_of_rows,
            queryParams:    @try.queryParams,
            search_engine:  @try.search_engine,
            searchUrl:      @try.searchUrl,
          }

          @new_try = @case.tries.build new_try_params

          try_number     = @case.lastTry + 1
          @new_try.tryNo = try_number
          @case.lastTry  = try_number

          if @new_try.save && @case.save
            @try.add_curator_vars @try.curator_vars_map
            Analytics::Tracker.track_try_saved_event current_user, @new_try

            respond_with @new_try, location: -> { api_case_try_path(@case, @new_try) }
          else
            render json: @new_try.errors.concat(@case.errors), status: :bad_request
          end
        end
        # rubocop:enable Metrics/MethodLength

        private

        def set_try
          @try = @case.tries.where(tryNo: params[:tryNo]).first

          render json: { message: 'Try not found!' }, status: :not_found unless @try
        end

        def update_try_params
          params.permit(:name)
        end

        def try_params
          params.permit(
            :name,
            :searchUrl,
            :fieldSpec,
            :queryParams,
            :search_engine,
            :escapeQuery,
            :number_of_rows
          )
        end
      end
    end
  end
end
