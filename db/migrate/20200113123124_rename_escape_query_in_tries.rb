class RenameEscapeQueryInTries < ActiveRecord::Migration
  def change
    rename_column :tries, :escapeQuery, :escape_query
  end
end
