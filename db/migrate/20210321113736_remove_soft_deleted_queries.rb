class RemoveSoftDeletedQueries < ActiveRecord::Migration[5.2]
  def change
    # The DELETE ... USING syntax below is MySQL-only; nothing to migrate away
    # from on a fresh SQLite database (soft-deleted queries were only ever a
    # MySQL production concern).
    return unless connection.adapter_name == 'Mysql2'

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
