# frozen_string_literal: true

module Api
  module V1
    module Bulk
      class QueriesController < Api::ApiController
        before_action :find_case
        before_action :check_case

        def create
          queries = []

          params[:queries].each do |query_text|
            queries << @case.queries.build(query_text: query_text)
          end

          if Query.import queries
            @case.reload
            @queries        = @case.queries.includes(%i[ratings test])
            @display_order  = @queries.map(&:id)

            respond_with @queries, @display_order
          else
            render status: :bad_request
          end
        end
      end
    end
  end
end
