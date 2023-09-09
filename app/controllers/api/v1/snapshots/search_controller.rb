# frozen_string_literal: true

module Api
  module V1
    module Snapshots
      class SearchController < SnapshotsController
        before_action :find_case
        before_action :check_case
        before_action :set_snapshot
        before_action :check_snapshot

        def index
          @q = params[:q]
          @query = if '*:*' == @q
                     @snapshot.snapshot_queries.first.query
                   else
                     @snapshot.case.queries.find_by(query_text: @q)
                   end

          if @query
            snapshot_query = @snapshot.snapshot_queries.find_by(query: @query)

            @snapshot_docs = snapshot_query.nil? ? [] : snapshot_query.snapshot_docs
          else
            @snapshot_docs = []
          end

          respond_with @snapshot
        end

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
