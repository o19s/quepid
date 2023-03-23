class AddDocIdToQueryDocPairs < ActiveRecord::Migration[6.1]
  def change
    add_column :query_doc_pairs, :doc_id, :string
  end
end
