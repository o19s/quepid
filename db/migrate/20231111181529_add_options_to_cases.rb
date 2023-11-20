class AddOptionsToCases < ActiveRecord::Migration[7.0]
  def change
    add_column :cases, :options, :json
  end
end
