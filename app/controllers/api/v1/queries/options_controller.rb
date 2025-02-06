# frozen_string_literal: true

module Api
  module V1
    module Queries
      class OptionsController < Api::V1::Queries::ApplicationController
        def show
          respond_with @query
        end

        def update
          if @query.update query_params
            Analytics::Tracker.track_query_options_updated_event current_user, @query
            respond_with @query
          else
            render json: @query.errors, status: :bad_request
          end
        end

        private

        def query_params
          params.expect(query: [ options: {} ])
        end
      end
    end
  end
end
