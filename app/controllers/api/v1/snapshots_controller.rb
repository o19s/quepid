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

      def create
        return render json: { error: 'Missing snapshot params' }, status: :bad_request unless params[:snapshot].present?
        return render json: { error: 'Snapshot name is required' }, status: :bad_request if params.dig(:snapshot, :name).blank?

        @snapshot = @case.snapshots.build(name: params[:snapshot][:name])
        @snapshot.scorer = @case.scorer
        atry = try_from_params || @case.tries.first
        @snapshot.try = atry

        if @snapshot.save
          docs = params.dig(:snapshot, :docs)
          queries = params.dig(:snapshot, :queries)

          if docs.present? && queries.present?
            # Client-side flow: Angular sends full docs/queries payload.
            # Use JSON (not Marshal) for security and Ruby-version stability.
            # Extract only docs/queries; to_unsafe_h preserves nested structure for JSON.
            payload = {
              snapshot: {
                docs:    params.dig(:snapshot, :docs)&.to_unsafe_h || {},
                queries: params.dig(:snapshot, :queries)&.to_unsafe_h || {}
              }
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

      def destroy
        @snapshot.destroy
        Analytics::Tracker.track_snapshot_deleted_event current_user, @snapshot

        head :no_content
      end

      private

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
      def fetch_record_document_fields(atry)
        raw = params.dig(:snapshot, :record_document_fields)
        return true if atry.nil? || atry.search_endpoint.nil?

        engine = atry.search_endpoint.search_engine.to_s.downcase
        must_record = !%w[solr es os].include?(engine)
        return true if must_record

        ActiveModel::Type::Boolean.new.cast(raw)
      end
    end
  end
end
