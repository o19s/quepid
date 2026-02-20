# frozen_string_literal: true

require 'action_view'
module Api
  module V1
    # @tags cases > snapshots
    class SnapshotsController < Api::ApiController
      include ActionView::Helpers::NumberHelper

      before_action :set_case
      before_action :check_case
      before_action :set_snapshot,    only: [ :show, :destroy ]
      before_action :check_snapshot,  only: [ :show, :destroy ]

      # Special handling for cases that are "public", and therefore it's snapshots
      def authenticate_api!
        set_case
        return true if @case&.public? || current_user

        render json:   { reason: 'Unauthorized!' },
               status: :unauthorized
      end

      def index
        @snapshots = @case.snapshots

        @shallow = 'true' == params[:shallow]
        @with_docs = false

        respond_with @snapshots
      end

      # @parameter id(path) [Integer] The ID of the requested snapshots.  Use `latest` to get the most recent snapshot for the case.
      # @parameter shallow(query) [Boolean] Show detailed snapshot data, defaults to false.
      def show
        @shallow = params[:shallow] || false
        @with_docs = true
        respond_with @snapshot
      end

      # rubocop:disable Metrics/AbcSize, Metrics/MethodLength
      def create
        return render json: { error: 'Missing snapshot params' }, status: :bad_request if params[:snapshot].blank?
        return render json: { error: 'Snapshot name is required' }, status: :bad_request if params.dig(:snapshot, :name).blank?

        @snapshot = @case.snapshots.build(name: params[:snapshot][:name])
        @snapshot.scorer = @case.scorer
        atry = try_from_params || @case.tries.first
        @snapshot.try = atry

        if @snapshot.save
          docs = params.dig(:snapshot, :docs)
          queries = params.dig(:snapshot, :queries)

          if docs.present? && queries.present?
            # Client-side flow: client sends full docs/queries payload (e.g. CSV import, snapshot restore).
            # Use JSON (not Marshal) for security and Ruby-version stability.
            # Convert params to plain hashes via JSON round-trip; strong params cannot express
            # the arbitrary nested structure from search engine responses (dynamic doc fields).
            # Data is serialized to storage and consumed by PopulateSnapshotJob, which extracts
            # only known fields (id, explain, fields, position, score, etc.) via SnapshotManager.
            payload = {
              snapshot: {
                docs:    extract_snapshot_payload_hash(params.dig(:snapshot, :docs)),
                queries: extract_snapshot_payload_hash(params.dig(:snapshot, :queries)),
              },
            }
            serialized_data = payload.to_json
            compressed_data = Zlib::Deflate.deflate(serialized_data)
            @snapshot.snapshot_file.attach(io: StringIO.new(compressed_data), filename: "snapshot_#{@snapshot.id}.bin.zip",
                                           content_type: 'application/zip')
            PopulateSnapshotJob.perform_later @snapshot
          else
            # Server-side flow: fetch from search endpoint (modern Take Snapshot)
            record_document_fields = fetch_record_document_fields(atry)
            CreateSnapshotFromSearchJob.perform_later @snapshot, user: current_user, record_document_fields: record_document_fields
          end

          Analytics::Tracker.track_snapshot_created_event current_user, @snapshot

          @with_docs = false # don't show individual docs in the response
          respond_with @snapshot
        else
          render json: @snapshot.errors, status: :bad_request
        end
      end
      # rubocop:enable Metrics/AbcSize, Metrics/MethodLength

      def destroy
        @snapshot.destroy
        Analytics::Tracker.track_snapshot_deleted_event current_user, @snapshot

        head :no_content
      end

      private

      # Converts ActionController::Parameters to plain Hash for JSON serialization.
      # Uses JSON round-trip instead of to_unsafe_h; structure comes from search engine
      # responses and cannot be expressed with strong parameters.
      def extract_snapshot_payload_hash value
        return {} if value.blank?

        JSON.parse(value.to_json, symbolize_names: true)
      end

      def set_snapshot
        @snapshot = if 'latest' == params[:id]
                      @case.snapshots.order(created_at: :desc).first
                    else
                      @case.snapshots
                        .where(id: params[:id])
                        .first
                    end
      end

      def check_snapshot
        render json: { error: 'Not Found!' }, status: :not_found unless @snapshot
      end

      def try_from_params
        try_num = params.dig(:snapshot, :try_number)
        return nil if try_num.blank?

        @case.tries.find_by(try_number: try_num)
      end

      # For server-side snapshot: engines that support doc lookup by ID (solr, es, os) can
      # optionally skip recording document fields. Others (e.g. searchapi) must record.
      def fetch_record_document_fields atry
        raw = params.dig(:snapshot, :record_document_fields)
        return true if atry.nil? || atry.search_endpoint.nil?

        engine = atry.search_endpoint.search_engine.to_s.downcase
        must_record = %w[solr es os].exclude?(engine)
        return true if must_record

        ActiveModel::Type::Boolean.new.cast(raw)
      end
    end
  end
end
