class FixCamelCaseInUserTable < ActiveRecord::Migration
  def change
    rename_column :users, :firstLogin, :first_login
  end
end
