class FixCamelCaseInUserTable < ActiveRecord::Migration[4.2]
  def change
    rename_column :users, :firstLogin, :first_login
  end
end
