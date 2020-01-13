class FixNumLoginsInUsers < ActiveRecord::Migration
  def change
    rename_column :users, :numLogins, :num_logins
  end
end
