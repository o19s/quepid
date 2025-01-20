class DropPermissionsTable < ActiveRecord::Migration[8.0]
  def change
        drop_table :permissions
  end
end
