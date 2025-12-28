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
        @snapshot = @case.snapshots.build(name: params[:snapshot][:name])
        @snapshot.scorer = @case.scorer
        @snapshot.try = @case.tries.first

        if @snapshot.save
          serialized_data = Marshal.dump(snapshot_params)

          #  puts "[SnapshotController] the size of the serialized data is #{number_to_human_size(serialized_data.bytesize)}"
          compressed_data = Zlib::Deflate.deflate(serialized_data)
          # puts "[SnapshotController] the size of the compressed data is #{number_to_human_size(compressed_data.bytesize)}"
          @snapshot.snapshot_file.attach(io: StringIO.new(compressed_data), filename: "snapshot_#{@snapshot.id}.bin.zip",
                                         content_type: 'application/zip')
          PopulateSnapshotJob.perform_later @snapshot

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

      def snapshot_params
        # avoid StrongParameters ;-( to faciliate sending params as
        # hash to ActiveJob via ActiveStorage by directly getting parameters from request
        # object
        request.parameters
      end
    end
  end
end
