class AddBookToCases < ActiveRecord::Migration[6.1]
  def change
    add_column :cases, :book_id, :int
  end
end
