# frozen_string_literal: true

require 'action_view'
module Api
  module V1
    class SnapshotsController < Api::ApiController
      include ActionView::Helpers::NumberHelper
      before_action :set_case
      before_action :check_case
      before_action :set_snapshot,    only: [ :show, :destroy ]
      before_action :check_snapshot,  only: [ :show, :destroy ]

      # Spiking out can we make an API public?
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

      def show
        @shallow = params[:shallow] || false
        @with_docs = true
        respond_with @snapshot
      end

      # rubocop:disable Layout/LineLength
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
      # rubocop:enable Layout/LineLength

      def destroy
        SnapshotDoc.joins(snapshot_query: :snapshot)
          .where(snapshot_queries: { snapshot: @snapshot })
          .delete_all
        @snapshot.snapshot_queries.delete_all
        @snapshot.destroy
        Analytics::Tracker.track_snapshot_deleted_event current_user, @snapshot

        head :no_content
      end

      private

      def set_snapshot
        @snapshot = @case.snapshots
          .where(id: params[:id])
          .first
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
