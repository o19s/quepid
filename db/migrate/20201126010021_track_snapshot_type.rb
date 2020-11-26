class TrackSnapshotType < ActiveRecord::Migration
  def change
    add_column :snapshot_docs, :rated_only, :boolean, default: false
  end
end
