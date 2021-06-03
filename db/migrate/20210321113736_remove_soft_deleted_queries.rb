class RemoveSoftDeletedQueries < ActiveRecord::Migration[5.2]
  def change

    # Delete from the database any snapshot related data for soft deleted queries.
    RemoveSoftDeletedQueries.connection.execute(
      "
      delete from snapshot_docs
      using queries inner join snapshot_queries  inner join snapshot_docs
      where queries.deleted = 1 and queries.id = snapshot_queries.query_id and snapshot_queries.id = snapshot_docs.snapshot_query_id
      "
    )

    RemoveSoftDeletedQueries.connection.execute(
      "
      delete from snapshot_queries
      using queries inner join snapshot_queries
      where queries.deleted = 1 and queries.id = snapshot_queries.query_id
      "
    )

    # Delete the soft deleted queries.
    RemoveSoftDeletedQueries.connection.execute(
      "
      delete from ratings
      using queries inner join ratings
      where queries.deleted = 1 and queries.id = ratings.query_id
      "
    )

    RemoveSoftDeletedQueries.connection.execute(
      "
      delete from queries
      where queries.deleted = 1
      "
    )

    remove_column :queries, :deleted
  end
end
