# frozen_string_literal: true

module Api
  module V1
    module Snapshots
      class SearchController < SnapshotsController
        before_action :set_case
        before_action :check_case
        before_action :set_snapshot
        before_action :check_snapshot

        # rubocop:disable Metrics/MethodLength
        # rubocop:disable Metrics/AbcSize
        # rubocop:disable Metrics/CyclomaticComplexity
        # rubocop:disable Metrics/PerceivedComplexity
        api :GET, '/api/cases/:case_id/snapshots/:snapshot_id/search?somesolrparams=here',
            'Mimic a Solr query by looking up query/doc data from a specific snapshot, supports a query or a lookup by id query'
        param :case_id, :number,
              desc: 'The ID of the requested case.', required: true
        param :snapshot_id, :number,
              desc: 'The ID of the snapshot for the case.', required: true
        param :q, String,
              desc: 'The query that you are looking up', required: true
        def index
          @q = search_params[:q]
          @snapshot_docs = nil

          @q = @q.gsub('\?', '?') # Since it's a GET, a ? in the query gets special escaping
          query = if '*:*' == @q
                    # we have a match all query.
                    @snapshot.snapshot_queries.first.query

                  elsif @q.ends_with?(')') && @q.include?(':(') && ('lucene' == search_params[:defType])
                    # We have a lookup docs by id query
                    doc_ids = @q[@q.index(':(') + 2...@q.index(')')].split(' OR ')
                    @snapshot_docs = @snapshot.snapshot_docs.where(doc_id: doc_ids)

                  else
                    @snapshot.case.queries.find_by(query_text: @q)
                  end

          if query && @snapshot_docs.nil?
            snapshot_query = @snapshot.snapshot_queries.find_by(query: query)

            @snapshot_docs = snapshot_query.nil? ? [] : snapshot_query.snapshot_docs
          elsif @q.starts_with?('id:') && !@q.starts_with?('id:(')
            doc_id = @q.split(':')[1]
            @snapshot_docs = @snapshot.snapshot_docs.where(doc_id: doc_id)
          elsif @snapshot_docs.nil?
            @snapshot_docs = []
          end

          rows = params[:rows].to_i if params[:rows]
          start = params[:start].to_i if params[:start]

          @number_found = @snapshot_docs.count

          if start && rows
            end_index = rows + start
            @snapshot_docs = @snapshot_docs[start...end_index]
          elsif rows
            @snapshot_docs = @snapshot_docs.take rows if rows
          end

          @solr_params = {
            q: @q,
          }
          @solr_params[:rows] = params[:rows] if params[:rows]
          @solr_params[:start] = params[:start] if params[:start]

          respond_with @snapshot
        end
        # rubocop:enable Metrics/MethodLength
        # rubocop:enable Metrics/AbcSize
        # rubocop:enable Metrics/CyclomaticComplexity
        # rubocop:enable Metrics/PerceivedComplexity
        # rubocop:enable Layout/LineLength

        private

        def search_params
          # Check if the 'q' parameter exists
          raise ActionController::ParameterMissing, "Missing 'q' parameter" unless params.key?(:q)

          params
        end

        def set_snapshot
          @snapshot = @case.snapshots
            .where(id: params[:snapshot_id])
            .includes([ snapshot_queries: [ :snapshot_docs ] ])
            .first
        end
      end
    end
  end
end
