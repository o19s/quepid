# frozen_string_literal: true

class SnapshotImporter
  def initialize acase
    @acase = acase
  end

  def import_snapshots data
    snapshots = []
    data.each do |snapshot_params|
      params = {
        name:       snapshot_params[:name],
        created_at: snapshot_params[:created_at],
      }

      snapshot = @acase.snapshots.create params

      service = SnapshotManager.new(snapshot)
      service.import_queries snapshot_params[:queries]

      snapshots << snapshot
    end

    snapshots
  end
end
