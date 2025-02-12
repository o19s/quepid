class UpdateQueryTextCollation < ActiveRecord::Migration[8.0]
  def up
      execute "ALTER TABLE queries MODIFY query_text VARCHAR(2048) CHARACTER SET utf8mb4 COLLATE utf8mb4_bin"
    end
  
    def down
      execute "ALTER TABLE queries MODIFY query_text VARCHAR(2048) CHARACTER SET utf8mb3 COLLATE utf8mb3_general_ci"
    end
end
