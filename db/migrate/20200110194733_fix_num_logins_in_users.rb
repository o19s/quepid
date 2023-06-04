class FixNumLoginsInUsers < ActiveRecord::Migration[4.2]
  def change
    rename_column :users, :numLogins, :num_logins
  end
end
