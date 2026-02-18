# frozen_string_literal: true

# Populates a snapshot from a compressed JSON payload stored in snapshot_file.
# The payload is JSON (not Marshal) for security and Ruby-version stability.
# See SnapshotsController#create for the serialization format.
class PopulateSnapshotJob < ApplicationJob
  queue_as :default

  def perform snapshot
    # Using Rails' bulk insert methods for better performance.
    compressed_data = snapshot.snapshot_file.download
    serialized_data = Zlib::Inflate.inflate(compressed_data)
    params = parse_snapshot_payload(serialized_data)

    service = SnapshotManager.new(snapshot)

    snapshot_docs = params[:snapshot][:docs]
    snapshot_queries = params[:snapshot][:queries]

    service.add_docs snapshot_docs, snapshot_queries

    snapshot.reload # this appears to be required or we duplicate the snapshot_queries!

    snapshot.snapshot_file.purge
  end

  private

  # Parses JSON payload and converts query_id keys to integers for SnapshotManager.
  def parse_snapshot_payload(serialized_data)
    parsed = JSON.parse(serialized_data, symbolize_names: true).deep_symbolize_keys
    snapshot = parsed[:snapshot] || {}
    docs = (snapshot[:docs] || {}).transform_keys { |k| k.to_s.to_i }
    queries = (snapshot[:queries] || {}).transform_keys { |k| k.to_s.to_i }
    { snapshot: { docs: docs, queries: queries } }
  end
end
