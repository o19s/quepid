# frozen_string_literal: true

module Api
  module V1
    module Bulk
      class QueriesController < Api::ApiController
        before_action :set_case
        before_action :check_case

        def_param_group :queries_params do
          param :queries, Array, required: true do
            param :queries, String
          end
        end

        # rubocop:disable Metrics/MethodLength
        api :POST, '/api/bulk/cases/:case_id/queries', 'Bulk create queries.'
        param :case_id, :number,
              desc: 'The ID of the requested case.', required: true
        param_group :queries_params
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
          non_existing_queries.each_with_index do |query_text, _index|
            queries_to_import << {
              case_id:    @case.id,
              query_text: query_text,
              created_at: Time.current,
              updated_at: Time.current,
            }
          end

          # rubocop:disable Rails/SkipsModelValidations
          Query.upsert_all(queries_to_import)
          # rubocop:enable Rails/SkipsModelValidations

          @case.reload
          @queries        = @case.queries.includes([ :ratings ])
          @display_order  = @queries.map(&:id)

          respond_with @queries, @display_order
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
