class ChangePositionToInt < ActiveRecord::Migration[6.1]
  def change
    change_column :query_doc_pairs, :position, :int
  end
end
