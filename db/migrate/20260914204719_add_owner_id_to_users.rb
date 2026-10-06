# frozen_string_literal: true

class AddOwnerIdToUsers < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :owner_id, :integer
    add_index :users, :owner_id, name: 'index_users_owner_id'
  end
end
