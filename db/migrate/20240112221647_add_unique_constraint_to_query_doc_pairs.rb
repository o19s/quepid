class AddUniqueConstraintToQueryDocPairs < ActiveRecord::Migration[7.1]
  def change
     add_index :query_doc_pairs, [:query_text, :doc_id, :book_id], unique: true, name: 'unique_query_doc_pair'
   end
end
