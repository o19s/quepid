class DropUnusedColumnsFromCases < ActiveRecord::Migration[4.2]
  def change
    remove_column :cases, :field_spec
    remove_column :cases, :search_url
  end
end
