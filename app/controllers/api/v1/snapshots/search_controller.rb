# frozen_string_literal: true

module Api
  module V1
    module Snapshots
      class SearchController < SnapshotsController
        before_action :find_case
        before_action :check_case
        before_action :set_snapshot
        before_action :check_snapshot

        # rubocop:disable Metrics/MethodLength
        def index
          @q = params[:q]
          query = if '*:*' == @q
                    @snapshot.snapshot_queries.first.query

                  else
                    @snapshot.case.queries.find_by(query_text: @q)
                  end

          if query
            snapshot_query = @snapshot.snapshot_queries.find_by(query: query)

            @snapshot_docs = snapshot_query.nil? ? [] : snapshot_query.snapshot_docs
          elsif @q.starts_with?('id')
            doc_id = @q.split(':')[1]
            @snapshot_docs = @snapshot.snapshot_docs.where(doc_id: doc_id)
          else
            @snapshot_docs = []
          end

          rows = params[:rows]

          @number_found = @snapshot_docs.count
          @snapshot_docs = @snapshot_docs.take rows if rows

          respond_with @snapshot
        end
        # rubocop:enable Metrics/MethodLength

        private

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
