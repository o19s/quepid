class AddTotalNumberResultsToSnapshotQueries < ActiveRecord::Migration[6.1]
  def change
    add_column :snapshot_queries, :number_of_results, :integer
  end
end
