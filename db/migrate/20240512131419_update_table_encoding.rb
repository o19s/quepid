class UpdateTableEncoding < ActiveRecord::Migration[7.1]
  # As part of https://github.com/o19s/quepid/issues/1013 
  # finally going through and trying to update the database table charset and collations
  # 
  @@tables_to_migrate = %w{annotations books case_metadata case_scores cases curator_variables judgements permissions queries query_doc_pairs ratings search_endpoints selection_strategies snapshot_docs snapshot_queries snapshots teams teams_cases teams_members teams_scorers tries users}
  def up    
    
    
    
    puts "special handling of query_doc_pairs.document_fields column"
    execute "ALTER TABLE query_doc_pairs MODIFY document_fields mediumtext CHARACTER SET utf8mb4;"
    
    remove_index :query_doc_pairs, name: 'unique_query_doc_pair' if index_exists?(:query_doc_pairs, [:query_text, :doc_id, :book_id])
    change_column :tries, :query_params, :text, limit: 16777215
    
    @@tables_to_migrate.each do |table|
      puts "Converting table #{table}"
      execute "ALTER TABLE #{table} CONVERT TO CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;"
    end
    
    #add_index :query_doc_pairs, [:query_text, :doc_id, :book_id], length: 255, unique: true, name: 'unique_query_doc_pair'

  end

  def down
    puts "undo special handling of query_doc_pairs.document_fields column"
    execute "ALTER TABLE query_doc_pairs MODIFY document_fields mediumtext CHARACTER SET utf8mb3;"
    
    @@tables_to_migrate.each do |table|
      puts "Undo Converting table #{table}"
      execute "ALTER TABLE #{table} CONVERT TO CHARACTER SET utf8mb3 COLLATE utf8mb3_unicode_ci;"
    end
  end
end
