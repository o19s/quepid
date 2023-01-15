class RenameRankColumnToPosition < ActiveRecord::Migration[6.1]
  def change
    rename_column :query_doc_pairs, :rank, :position
  end
end
