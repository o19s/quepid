class DropUnusedColumnsFromCases < ActiveRecord::Migration
  def change
    remove_column :cases, :field_spec
    remove_column :cases, :search_url
  end
end
