class AddIndexesToSearchEndpoints < ActiveRecord::Migration[8.0]
  def change
    add_index :search_endpoints, [:owner_id, :id]  
    add_index :teams_search_endpoints, [:search_endpoint_id, :team_id]
    add_index :teams_members, [:member_id, :team_id]
  end
end
