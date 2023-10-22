class ExtractSearchEndpoint < ActiveRecord::Migration[7.0]
  def change
        
    create_table :search_endpoints  do |t|
      t.string "name", limit: 255
      t.integer "owner_id"
      t.string "search_engine", limit: 50
      t.string "endpoint_url", limit: 500
      t.string "api_method"
      t.string "custom_headers", limit: 1000
      t.boolean "archived", default: false
      t.timestamps
    end
    
    add_column :tries, :search_endpoint_id, :bigint, foreign_key: true
  end
end
