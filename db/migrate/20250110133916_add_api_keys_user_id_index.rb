class AddApiKeysUserIdIndex < ActiveRecord::Migration[8.0]
  def change
    add_index :api_keys, :user_id, name: :index_api_keys_user_id
  end
end
