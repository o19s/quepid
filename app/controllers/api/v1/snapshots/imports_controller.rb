# frozen_string_literal: true

module Api
  module V1
    module Snapshots
      class ImportsController < Api::ApiController
        before_action :set_case
        before_action :check_case

        def create
          service = SnapshotImporter.new(@case)
          @snapshots = service.import_snapshots params[:snapshots]

          respond_with @snapshots
        end
      end
    end
  end
end
