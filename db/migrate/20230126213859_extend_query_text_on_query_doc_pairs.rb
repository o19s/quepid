class ExtendQueryTextOnQueryDocPairs < ActiveRecord::Migration[6.1]
  def change
    change_column :query_doc_pairs, :query_text, :string, :limit => 500
  end
end
