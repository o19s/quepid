# frozen_string_literal: true

module Api
  module V1
    class SnapshotsController < Api::ApiController
      before_action :find_case
      before_action :check_case
      before_action :set_snapshot,    only: [ :show, :destroy ]
      before_action :check_snapshot,  only: [ :show, :destroy ]

      def index
        @snapshots = @case.snapshots

        respond_with @snapshots
      end

      def create
        @snapshot = @case.snapshots.build snapshot_params

        if @snapshot.save
          service = SnapshotManager.new(@snapshot)

          snapshot_docs = params[:snapshot][:docs]

          service.add_docs params[:snapshot][:docs] if snapshot_docs

          Analytics::Tracker.track_snapshot_created_event current_user, @snapshot

          # Refetch snapshot because after bulk creating the docs
          # the snapshot object is then  stale
          @snapshot = Snapshot.where(id: @snapshot.id)
            .includes([ snapshot_queries: [ :snapshot_docs ] ])
            .first

          respond_with @snapshot
        else
          render json: @snapshot.errors, status: :bad_request
        end
      end

      def show
        respond_with @snapshot
      end

      def destroy
        @snapshot.destroy
        Analytics::Tracker.track_snapshot_deleted_event current_user, @snapshot

        render json: {}, status: :no_content
      end

      private

      def snapshot_params
        params.require(:snapshot).permit(:name)
      end

      def set_snapshot
        @snapshot = @case.snapshots
          .where(id: params[:id])
          .includes([ snapshot_queries: [ :snapshot_docs ] ])
          .first
      end

      def check_snapshot
        render json: { error: 'Not Found!' }, status: :not_found unless @snapshot
      end
    end
  end
end
