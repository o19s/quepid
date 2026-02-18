# frozen_string_literal: true

module Api
  module V1
    module Tries
      module Queries
        # Executes a single query against the try's search endpoint and returns
        # documents and metadata. Used by the modern workspace results pane to
        # display live search results.
        #
        # Supports JSON (default) and HTML formats. When Accept includes text/html,
        # returns server-rendered document cards (DocumentCardComponent + MatchesComponent).
        #
        # @see docs/workspace_api_usage.md
        # @see docs/legacy_assets_remaining.md (query execution API)
        class SearchController < Api::ApiController
          skip_before_action :set_default_response_format, only: [ :show ]
          before_action :set_case
          before_action :check_case
          before_action :set_try
          before_action :check_try
          before_action :set_query
          before_action :check_query
          before_action :check_search_endpoint
          before_action :set_search_response_format, only: [ :show ]

          # GET api/cases/:case_id/tries/:try_number/queries/:query_id/search
          #
          # Query params:
          #   q [String] Optional. Override query text for search (DocFinder: "Find and rate missing documents").
          #   rows [Integer] Optional. Number of documents to return (default: try's number_of_rows).
          #   start [Integer] Optional. Offset for pagination (default: 0).
          #   diff_snapshot_ids[] [Array<Integer>] Optional. Snapshot IDs to diff against.
          #
          # Returns JSON (default): { docs: [...], num_found: N, ratings: { doc_id => rating } }
          # Returns HTML (Accept: text/html): Document cards for results pane (DocumentCardComponent)
          def show
            query_text_override = params[:q].presence
            rows = params[:rows].presence&.to_i
            start_offset = params[:start].presence&.to_i
            start_offset = 0 if start_offset&.negative?
            result = QuerySearchService.new.execute(
              @try,
              @query,
              query_text_override: query_text_override,
              rows: rows,
              start: start_offset
            )

            if result[:error]
              render json: { error: result[:error] }, status: result[:response_status] || :bad_request
              return
            end

            # Merge ratings (doc_id => rating) into response
            ratings_map = @query.ratings.fully_rated.pluck(:doc_id, :rating).to_h
            scorer_scale = @case.scorer&.scale || [ 0, 1, 2, 3 ]

            # Build diff entries map when comparing with snapshots
            diff_entries_map = build_diff_entries_map(params[:diff_snapshot_ids])

            respond_to do |format|
              format.html do
                render partial: "api/v1/tries/queries/search/document_cards",
                       locals: {
                         docs:              result[:docs],
                         num_found:         result[:num_found],
                         ratings_map:       ratings_map,
                         scorer_scale:      scorer_scale,
                         diff_entries_map:  diff_entries_map
                       },
                       layout: false
              end
              format.json do
                render json: {
                  docs:            result[:docs],
                  num_found:       result[:num_found],
                  ratings:         ratings_map,
                  response_status: result[:response_status]
                }
              end
            end
          end

          private

          def set_try
            try_num = params[:try_try_number] || params[:try_number]
            @try = @case.tries.find_by(try_number: try_num)
          end

          def check_try
            render json: { error: 'Try not found' }, status: :not_found unless @try
          end

          def set_query
            @query = @case.queries.find_by(id: params[:query_id])
          end

          def check_query
            render json: { error: 'Query not found' }, status: :not_found unless @query
          end

          def check_search_endpoint
            return if @try.nil? || @query.nil?

            if @try.search_endpoint.nil?
              render json: { error: 'No search endpoint configured for this try' }, status: :bad_request
            elsif @try.search_endpoint.search_engine == 'static'
              render json: { error: 'Static search engine does not support live search' }, status: :bad_request
            end
          end

          # Build a map of { doc_id => [{ position: N, name: "Snapshot X" }] } for diff badges.
          # Only queries SnapshotQuery rows for THIS query (not all queries in each snapshot).
          def build_diff_entries_map(snapshot_ids)
            return {} if snapshot_ids.blank?

            snapshot_ids = Array(snapshot_ids).map(&:to_i).reject(&:zero?)
            return {} if snapshot_ids.empty?

            # Load snapshot names for display
            snapshots = @case.snapshots.where(id: snapshot_ids).index_by(&:id)

            # Load snapshot_queries for this query in the requested snapshots, with their docs
            snapshot_queries = SnapshotQuery
              .where(snapshot_id: snapshot_ids, query_id: @query.id)
              .includes(:snapshot_docs)

            # Build { doc_id => [{ position: N, name: "Snapshot X" }] }
            entries_map = Hash.new { |h, k| h[k] = [] }
            snapshot_queries.each do |sq|
              snapshot_name = snapshots[sq.snapshot_id]&.name || "Snapshot #{sq.snapshot_id}"
              sq.snapshot_docs.each do |sd|
                entries_map[sd.doc_id.to_s] << { position: sd.position, name: snapshot_name }
              end
            end

            entries_map
          end

          def set_search_response_format
            request.format = :html if request.headers["Accept"]&.include?("text/html")
            request.format = :json if request.format != :html
          end
        end
      end
    end
  end
end
