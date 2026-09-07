class UpdateQueryTextCollation < ActiveRecord::Migration[8.0]
  def up
      # ALTER TABLE ... MODIFY ... COLLATE is MySQL-only DDL. SQLite's default
      # comparison is already case-sensitive (equivalent to utf8mb4_bin), so
      # there's nothing to change there.
      return unless connection.adapter_name == 'Mysql2'

      execute "ALTER TABLE queries MODIFY query_text VARCHAR(2048) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin"
    end

    def down
      return unless connection.adapter_name == 'Mysql2'

      execute "ALTER TABLE queries MODIFY query_text VARCHAR(2048) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci"
    end
end
