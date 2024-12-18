class AddQueryDocPairsCountToBooks < ActiveRecord::Migration[8.0]
  def change
    add_column :books, :query_doc_pairs_count, :integer, default: 0, null: false
  end
end
