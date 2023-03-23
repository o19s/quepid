class AddScoreToSnapshotQueries < ActiveRecord::Migration[6.1]
  def change
    add_column :snapshot_queries, :score, :float
    add_column :snapshot_queries, :all_rated, :boolean
  end
end
