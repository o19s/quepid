class AddIndexToUserNames < ActiveRecord::Migration[7.0]
  def change
      add_index :users, :name
  end
end
