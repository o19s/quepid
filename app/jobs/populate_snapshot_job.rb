# frozen_string_literal: true

class PopulateSnapshotJob < ApplicationJob
  queue_as :default
  sidekiq_options log_level: :warn

  # rubocop:disable Security/MarshalLoad
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  def perform snapshot
    # down the road we should be using ActiveRecord-import and first_or_initialize instead.
    # See how snapshots are managed.

    compressed_data = snapshot.snapshot_file.download
    serialized_data = Zlib::Inflate.inflate(compressed_data)
    params = Marshal.load(serialized_data)

    puts "[PopulateSnapshotJob] I am going to populate the snapshot with #{params[:snapshot][:queries].size} queries"

    service = SnapshotManager.new(snapshot)

    snapshot_docs = params[:snapshot][:docs]
    snapshot_queries = params[:snapshot][:queries]

    service.add_docs snapshot_docs, snapshot_queries if snapshot_docs
    
    snapshot.snapshot_file.purge
    snapshot.save
    
  end
  # rubocop:enable Security/MarshalLoad
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/AbcSize
end
