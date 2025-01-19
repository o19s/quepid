# Loaded configurations: .database_consistency.yml, .database_consistency.todo.yml
# UniqueIndexChecker fail Score index_case_scores_annotation_id index is unique in the database but do not have uniqueness validator
# LengthConstraintChecker fail User system_prompt column has limit in the database but do not have length validator
# LengthConstraintChecker fail User openai_key column has limit in the database but do not have length validator
# ForeignKeyChecker fail WebRequest snapshot_query should have foreign key in the database
# MissingIndexChecker fail SnapshotQuery web_request associated model should have proper unique index in the database

class AddUniqueIndexToWebRequestsSnapshotQueryId < ActiveRecord::Migration[8.0]
  def change
      remove_index :web_requests, :snapshot_query_id if index_exists?(:web_requests, :snapshot_query_id)
      add_index :web_requests, :snapshot_query_id, unique: true
      add_foreign_key :web_requests, :snapshot_queries
    end
end
