class DropDisplayPositionFromCases < ActiveRecord::Migration[4.2]
  def change
    remove_column :cases, :displayPosition
  end
end
