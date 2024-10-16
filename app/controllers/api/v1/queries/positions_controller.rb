# frozen_string_literal: true

module Api
  module V1
    module Queries
      class PositionsController < Api::V1::Queries::ApplicationController
        def update
          if @query.move_to(params[:after], params[:reverse])

            @case.queries.reload # Need to reload to reflect change
            @display_order = @case.queries.map(&:id)

            respond_with @query, @display_order
          else
            render json: @query.errors, status: :bad_request
          end
        end
      end
    end
  end
end
