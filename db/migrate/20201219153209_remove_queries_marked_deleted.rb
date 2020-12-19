class RemoveQueriesMarkedDeleted < ActiveRecord::Migration[5.2]
  def change

    # Let's go and delete queries that are marked as deleted.
    RemoveQueriesMarkedDeleted.connection.execute(
      #"DELETE from queries where deleted = 1"
    )
  end
end
