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
          non_existing_queries.each_with_index do |query_text, index|
            puts "building query #{query_text}"
            puts @case.queries.size
            query = @case.queries.build(query_text: query_text)
            puts "query.id: #{query.id}"
            query.insert_at(index + 1) # actually triggers an insert, but why???
            queries_to_import << query
            puts "query.id: #{query.id}"
          end

          # Mass insert queries
          require 'pp'
          pp queries_to_import
          #if Query.import queries_to_import

            @case.reload
            @queries        = @case.queries.includes([ :ratings ])
            @display_order  = @queries.map(&:id)

            respond_with @queries, @display_order
            #else
            #render status: :bad_request
            #end
        end
        # rubocop:enable Metrics/MethodLength

        def destroy
          @case.queries.destroy_all
          head :no_content
        end
      end
    end
  end
end
