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
          # rubocop:disable Metrics/AbcSize, Metrics/MethodLength
          def show
            query_text_override = params[:q].presence
            rows = params[:rows].presence&.to_i
            start_offset = params[:start].presence&.to_i
            start_offset = 0 if start_offset&.negative?
            result = QuerySearchService.new.execute(
              @try,
              @query,
              query_text_override: query_text_override,
              rows:                rows,
              start:               start_offset
            )

            if result[:error]
              render json: { error: result[:error] }, status: result[:response_status] || :bad_request
              return
            end

            # Merge ratings (doc_id => rating) into response
            ratings_map = @query.ratings.fully_rated.pluck(:doc_id, :rating).to_h
            scorer_scale = @case.scorer&.scale || [ 0, 1, 2, 3 ]

            # Filter to only rated docs when requested
            if deserialize_bool_param(params[:show_only_rated])
              rated_doc_ids = ratings_map.keys.to_set(&:to_s)
              result[:docs] = result[:docs].select { |doc| rated_doc_ids.include?(doc['id'].to_s) }
            end

            # Build diff data (shared query for both badge map and side-by-side columns)
            diff_entries_map, diff_columns = build_diff_data(params[:diff_snapshot_ids])

            respond_to do |format|
              format.html do
                render partial: 'api/v1/tries/queries/search/document_cards',
                       locals:  {
                         docs:             result[:docs],
                         num_found:        result[:num_found],
                         max_score:        result[:max_score],
                         querqy_triggered: result[:querqy_triggered],
                         ratings_map:      ratings_map,
                         scorer_scale:     scorer_scale,
                         diff_entries_map: diff_entries_map,
                         diff_columns:     diff_columns,
                         image_prefix:     @try.image_prefix_from_field_spec,
                         scoring_depth:    @try.number_of_rows || 10,
                         browse_url:       build_browse_url(@try, @query),
                       },
                       layout:  false
              end
              format.json do
                render json: {
                  docs:            result[:docs],
                  num_found:       result[:num_found],
                  ratings:         ratings_map,
                  response_status: result[:response_status],
                }
              end
            end
          end
          # rubocop:enable Metrics/AbcSize, Metrics/MethodLength

          # GET api/cases/:case_id/tries/:try_number/queries/:query_id/search/raw?doc_id=xxx
          #
          # Returns the raw, unprocessed search engine response for a single document.
          # Auth credentials and proxy settings are handled server-side via FetchService
          # so they are never exposed to the browser.
          def raw
            doc_id = params[:doc_id].presence
            return render(json: { error: 'doc_id parameter is required' }, status: :bad_request) unless doc_id

            fetch_service = FetchService.new(fake_mode: false, debug_mode: false)
            response = fetch_service.make_request(
              @try,
              @query,
              query_text_override: doc_id,
              rows:                1
            )

            render body: response.body, content_type: 'application/json', status: response.status
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
            elsif 'static' == @try.search_endpoint.search_engine
              render json: { error: 'Static search engine does not support live search' }, status: :bad_request
            end
          end

          # Build both diff structures from a single set of DB queries:
          #   entries_map: { doc_id => [{ position: N, name: "Snapshot X" }] } for badge display
          #   columns: [{ name: String, docs: [...], query_score: Float, case_score: Float }]
          # Returns [entries_map, columns]
          # rubocop:disable Metrics/CyclomaticComplexity, Metrics/PerceivedComplexity
          def build_diff_data snapshot_ids
            return [ {}, [] ] if snapshot_ids.blank?

            snapshot_ids = Array(snapshot_ids).map(&:to_i).reject(&:zero?)
            return [ {}, [] ] if snapshot_ids.empty?

            snapshots = @case.snapshots.where(id: snapshot_ids).index_by(&:id)
            snapshot_queries = SnapshotQuery
              .where(snapshot_id: snapshot_ids, query_id: @query.id)
              .includes(:snapshot_docs)

            # Pre-fetch case-level scores for each snapshot's try
            try_ids = snapshots.values.filter_map(&:try_id).uniq
            case_scores_by_try = Score.where(case_id: @case.id, try_id: try_ids)
              .group(:try_id)
              .maximum(:score)

            entries_map = Hash.new { |h, k| h[k] = [] }
            columns = snapshot_ids.filter_map do |sid|
              snapshot = snapshots[sid]
              next unless snapshot

              snapshot_name = snapshot.name.presence || "Snapshot #{sid}"
              sq = snapshot_queries.find { |s| s.snapshot_id == sid }
              col_docs = (sq&.snapshot_docs || []).sort_by(&:position).map do |sd|
                doc_id_str = sd.doc_id.to_s
                entries_map[doc_id_str] << { position: sd.position, name: snapshot_name }
                { doc_id: doc_id_str, position: sd.position }
              end

              {
                name:        snapshot_name,
                docs:        col_docs,
                query_score: sq&.score,
                case_score:  case_scores_by_try[snapshot.try_id],
              }
            end

            [ entries_map, columns ]
          end
          # rubocop:enable Metrics/CyclomaticComplexity, Metrics/PerceivedComplexity

          # Build a browse URL to view results directly on the search engine.
          # Only supported for Solr (admin/select UI) and ES/OS (_search endpoint).
          def build_browse_url a_try, query
            return nil if a_try&.search_endpoint&.endpoint_url.blank?

            endpoint = a_try.search_endpoint
            base_url = endpoint.endpoint_url.chomp('/')
            engine = endpoint.search_engine

            case engine
            when 'solr'
              # Solr: append query params with the query text substituted
              qp = a_try.query_params.to_s.gsub("#{$query}##", CGI.escape(query.query_text.to_s))
              "#{base_url}?#{qp}"
            when 'es', 'os'
              # ES/OS: link to the _search endpoint
              "#{base_url}/_search"
            end
          end

          def set_search_response_format
            requested_format = params[:format]&.to_sym

            request.format =
              if :html == requested_format || request.headers['Accept']&.include?('text/html')
                :html
              else
                :json
              end
          end
        end
      end
    end
  end
end
