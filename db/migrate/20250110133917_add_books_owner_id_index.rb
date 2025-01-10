class AddBooksOwnerIdIndex < ActiveRecord::Migration[8.0]
  def change
    add_index :books, :owner_id, name: :index_books_owner_id
  end
end
