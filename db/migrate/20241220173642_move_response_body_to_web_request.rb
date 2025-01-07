class MoveResponseBodyToWebRequest < ActiveRecord::Migration[8.0]
  def change
      create_table :web_requests do |t|
        t.integer :snapshot_query_id
        t.binary :request
        # okay with duplicating this in snapshot_queries for now.
        t.integer :response_status, :integer
        t.binary :response, limit: 100.megabytes
        
        t.timestamps
      end
  
      remove_column :snapshot_queries, :response_body
    end
  
end
