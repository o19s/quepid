class RemoveUserFromQueryDocPair < ActiveRecord::Migration[6.1]
  # We don't track who creates a query in the queries table, and I think that this type
  # of logging is really something we should do orthogonally and across the database through
  # event tracking.   We don't actually care who creates the query.  We are interested in
  # who judges a query.
  def change
    remove_column :query_doc_pairs, :user_id
  end
end
