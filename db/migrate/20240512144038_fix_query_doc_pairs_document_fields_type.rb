class FixQueryDocPairsDocumentFieldsType < ActiveRecord::Migration[7.1]
  def change
    # ALTER TABLE ... MODIFY is MySQL-only DDL; SQLite's TEXT/BLOB columns are
    # already unbounded, so there's no equivalent "mediumtext" sizing to apply.
    return unless connection.adapter_name == 'Mysql2'

    execute "ALTER TABLE query_doc_pairs MODIFY document_fields mediumtext CHARACTER SET utf8mb4"
  end
end
