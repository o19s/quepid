class AddIndexToTriesForSearchendpoints < ActiveRecord::Migration[7.0]
  def change
    # we got out of order in migrations, so lets check that it doesn't
    # already exist!
    unless index_exists?(:tries, :search_endpoint_id)
      add_index :tries, :search_endpoint_id    
    end
  end
end
