class AddIndexToTriesForSearchendpoints < ActiveRecord::Migration[7.0]
  def change
    add_index :tries, :search_endpoint_id    
  end
end
