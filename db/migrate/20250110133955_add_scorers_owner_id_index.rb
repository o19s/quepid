class AddScorersOwnerIdIndex < ActiveRecord::Migration[8.0]
  def change
    add_index :scorers, :owner_id, name: :index_scorers_owner_id
  end
end
