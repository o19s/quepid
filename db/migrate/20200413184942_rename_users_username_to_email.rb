class RenameUsersUsernameToEmail < ActiveRecord::Migration[4.2]
  def change
    rename_column :users, :username, :email
  end
end
