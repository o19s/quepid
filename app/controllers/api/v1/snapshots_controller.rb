# frozen_string_literal: true

require 'action_view'
module Api
  module V1
    # @tags cases > snapshots
    class SnapshotsController < Api::ApiController
      include ActionView::Helpers::NumberHelper

      before_action :set_case
      before_action :set_snapshot, only: [ :show, :destroy ]

      # Snapshots of a public case can be read without logging in; creating or deleting them requires a user.
      def authenticate_api!
        if [ :index, :show ].include?(action_name.to_sym)
          set_case
          return true if @case&.public?
        end

        super
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
          DeferredPayload.stash!(snapshot_params, filename: "snapshot_#{@snapshot.id}.bin.zip", attachment: @snapshot.snapshot_file)
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
                      @case.snapshots.order(created_at: :desc).first!
                    else
                      @case.snapshots.find(params.expect(:id))
                    end
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
