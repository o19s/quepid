class AddResponseFieldsToSnapshotQueries < ActiveRecord::Migration[7.1]
  def change
    add_column :snapshot_queries, :response_status, :integer
    add_column :snapshot_queries, :response_body, :text
  end
end
