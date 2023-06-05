class RenameEscapeQueryInTries < ActiveRecord::Migration[4.2]
  def change
    rename_column :tries, :escapeQuery, :escape_query
  end
end
