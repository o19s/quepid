# frozen_string_literal: true

class PopulateSnapshotJob < ApplicationJob
  queue_as :default

  def perform snapshot
    # Using Rails' bulk insert methods for better performance.

    DeferredPayload.consume(snapshot.snapshot_file) do |params|
      service = SnapshotManager.new(snapshot)
      service.add_docs params[:snapshot][:docs], params[:snapshot][:queries]
      snapshot.reload # Avoid duplicating the cached snapshot_queries association.
    end
  end
end
