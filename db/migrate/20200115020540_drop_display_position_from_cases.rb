class DropDisplayPositionFromCases < ActiveRecord::Migration
  def change
    remove_column :cases, :displayPosition
  end
end
