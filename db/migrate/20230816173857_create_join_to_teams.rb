class CreateJoinToTeams < ActiveRecord::Migration[7.0]
  def change
    create_join_table :search_endpoints, :teams, table_name: :teams_search_endpoints do |t|
    end

  end
end
