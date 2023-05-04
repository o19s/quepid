class ExtendDocIdColumnLength < ActiveRecord::Migration[6.1]
  def change
    change_column :query_doc_pairs, :doc_id, :string, :limit => 500
  end
end
