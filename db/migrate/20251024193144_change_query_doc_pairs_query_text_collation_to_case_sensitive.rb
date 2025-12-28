class ChangeQueryDocPairsQueryTextCollationToCaseSensitive < ActiveRecord::Migration[8.0]
  # In the Quepid application, the `query_text` column in the `query_doc_pairs` table 
  # was configured with a case-insensitive collation (`utf8mb3_unicode_ci`). 
  # This means that when searching for query-doc pairs using `find_by(query_text: ...)`, 
  # two different queries that vary only in case (e.g., "Test Query" and "test query") 
  # would be treated as the same query.
    
  def up
    # Change the collation of query_text to utf8mb4_bin (case sensitive)
    execute <<-SQL
      ALTER TABLE query_doc_pairs 
      MODIFY query_text VARCHAR(2048) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin;
    SQL
  end

  def down
    # Revert back to the original case-insensitive collation
    execute <<-SQL
      ALTER TABLE query_doc_pairs 
      MODIFY query_text VARCHAR(2048) CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci;
    SQL
  end
end
