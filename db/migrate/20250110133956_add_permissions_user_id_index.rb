class AddPermissionsUserIdIndex < ActiveRecord::Migration[8.0]
  def change
    add_index :permissions, :user_id, name: :index_permissions_user_id
  end
end
