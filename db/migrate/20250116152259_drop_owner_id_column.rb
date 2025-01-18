class DropOwnerIdColumn < ActiveRecord::Migration[8.0]
  def change
    remove_column :teams,:owner_id
  end
end
