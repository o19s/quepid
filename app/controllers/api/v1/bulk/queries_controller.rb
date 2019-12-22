# frozen_string_literal: true

module Api
  module V1
    module Bulk
      class QueriesController < Api::ApiController
        before_action :find_case
        before_action :check_case

        # rubocop:disable Metrics/MethodLength
        def create
          # This logic is very similar to the ratings_importer.rb logic.
          queries_to_import = []

          unique_queries = params[:queries].uniq

          # b. Fetch all the existing queries
          queries_params = {
            query_text: unique_queries,
            case_id:    @case.id,
          }
          indexed_queries = Query.where(queries_params)
            .all
            .index_by(&:query_text)

          # c. Determine which queries do not already exist
          existing_queries = indexed_queries.keys

          non_existing_queries = unique_queries - existing_queries

          non_existing_queries.each do |query_text|
            queries_to_import << @case.queries.build(query_text: query_text)
          end

          # Mass insert queries
          if Query.import queries_to_import

            @case.reload
            @queries        = @case.queries.includes(%i[ratings test])
            @display_order  = @queries.map(&:id)

            respond_with @queries, @display_order
          else
            render status: :bad_request
          end
        end
        # rubocop:enable Metrics/MethodLength
      end
    end
  end
end
