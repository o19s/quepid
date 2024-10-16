class ExtendQueryDocQueryTextLength < ActiveRecord::Migration[7.1]
  def up
    # this index prevents us from having long queries.  Let's deal with it another way.
    remove_index :query_doc_pairs, [:query_text, :doc_id, :book_id]
    change_column :query_doc_pairs, :query_text, :string, limit: 2048
  end

  def down
    change_column :query_doc_pairs, :query_text, :string, limit: 500
  end
end
