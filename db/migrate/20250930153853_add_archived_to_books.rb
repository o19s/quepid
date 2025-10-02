class AddArchivedToBooks < ActiveRecord::Migration[8.0]
  def change
    add_column :books, :archived, :boolean, default: false, null: false
  end
end
