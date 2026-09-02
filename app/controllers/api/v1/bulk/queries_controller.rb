# frozen_string_literal: true

module Api
  module V1
    module Bulk
      # @tags cases > queries
      class QueriesController < Api::ApiController
        before_action :set_case
        before_action :check_case

        # @summary Bulk create queries
        # @request_body Query to be created
        #   [
        #     !Hash{
        #       queries: Array<String>
        #     }
        #   ]
        # @request_body_example bulk queries
        #   [JSON{
        #     "queries": ["star wars", "star trek"]
        #   }]
        def create
          # This logic is very similar to the ratings_importer.rb logic.
          queries_to_import = []

          unique_queries = params.expect(queries: []).uniq

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
          non_existing_queries.each_with_index do |query_text, _index|
            queries_to_import << {
              case_id:    @case.id,
              query_text: query_text,
              created_at: Time.current,
              updated_at: Time.current,
            }
          end

          # insert_all, not upsert_all: queries_to_import is already filtered down to
          # non-existing (case_id, query_text) pairs above, and there's no unique index
          # on queries for upsert_all to target on SQLite/Postgres anyway.
          Query.insert_all(queries_to_import)
          # rubocop:enable Rails/SkipsModelValidations

          @case.reload
          @queries        = @case.queries.includes([ :ratings ])
          @display_order  = @queries.map(&:id)

          respond_with @queries, @display_order
        end

        # @summary Delete all queries
        # @tags cases > queries
        def destroy
          @case.queries.destroy_all
          head :no_content
        end
      end
    end
  end
end
