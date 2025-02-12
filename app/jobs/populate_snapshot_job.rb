# frozen_string_literal: true

class PopulateSnapshotJob < ApplicationJob
  queue_as :default

  # rubocop:disable Security/MarshalLoad
  def perform snapshot
    # down the road we should be using ActiveRecord-import and first_or_initialize instead.
    # See how snapshots are managed.

    compressed_data = snapshot.snapshot_file.download
    serialized_data = Zlib::Inflate.inflate(compressed_data)
    params = Marshal.load(serialized_data)

    service = SnapshotManager.new(snapshot)

    snapshot_docs = params[:snapshot][:docs]
    snapshot_queries = params[:snapshot][:queries]

    service.add_docs snapshot_docs, snapshot_queries

    snapshot.reload # this appears to be required or we duplicate the snapshot_queries!

    snapshot.snapshot_file.purge
  end
  # rubocop:enable Security/MarshalLoad
end
