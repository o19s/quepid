class DropExtraTryFields < ActiveRecord::Migration[7.1]
  # we left the fields on Try when we introduced Search Endpoints
  # in case we needed to rollback.  However, we can now do the 
  # cleanup!
  def change
    remove_column :tries, :api_method
    remove_column :tries, :custom_headers
    remove_column :tries, :search_engine
    remove_column :tries, :search_url
  end
end
