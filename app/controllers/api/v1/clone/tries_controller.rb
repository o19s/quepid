# frozen_string_literal: true

module Api
  module V1
    module Clone
      class TriesController < Api::ApiController
        before_action :set_case
        before_action :check_case
        before_action :set_try, only: [ :create ]

        def create
          new_try_params = {
            escape_query:    @try.escape_query,
            search_endpoint: @try.search_endpoint,
            field_spec:      @try.field_spec,
            number_of_rows:  @try.number_of_rows,
            query_params:    @try.query_params,

          }

          @new_try = @case.tries.build new_try_params
          @new_try.parent = @try

          try_number = @case.last_try_number + 1

          @new_try.try_number   = try_number
          @case.last_try_number = try_number

          if @new_try.save && @case.save
            @try.add_curator_vars @try.curator_vars_map
            Analytics::Tracker.track_try_saved_event current_user, @new_try

            respond_with @new_try, location: -> { api_case_try_path(@case, @new_try) }
          else
            render json: @new_try.errors.concat(@case.errors), status: :bad_request
          end
        end

        private

        def set_try
          @try = @case.tries.where(try_number: params[:try_number]).first

          render json: { message: 'Try not found!' }, status: :not_found unless @try
        end

        def try_params
          params.expect(
            try: [ :name,
                   :field_spec,
                   :query_params,
                   :escape_query,
                   :number_of_rows ]
          )
        end
      end
    end
  end
end
