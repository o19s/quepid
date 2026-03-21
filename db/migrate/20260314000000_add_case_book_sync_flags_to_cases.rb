class AddCaseBookSyncFlagsToCases < ActiveRecord::Migration[8.0]
  def change
    add_column :cases, :auto_populate_book_pairs, :boolean, default: false, null: false
    add_column :cases, :auto_populate_case_judgements, :boolean, default: true, null: false
  end
end
