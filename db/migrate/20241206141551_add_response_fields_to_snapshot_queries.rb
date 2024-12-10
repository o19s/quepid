class AddResponseFieldsToSnapshotQueries < ActiveRecord::Migration[7.2]
  def change
    add_column :snapshot_queries, :response_status, :integer
    add_column :snapshot_queries, :response_body, :binary, limit: 100.megabytes
  end
end
