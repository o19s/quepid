class AddOptionsToUsers < ActiveRecord::Migration[8.0]
  def change
    add_column :users, :options, :json
  end
end
