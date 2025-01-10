class AddCasesBookIdIndex < ActiveRecord::Migration[8.0]
  def change
    add_index :cases, :book_id, name: :index_cases_book_id
  end
end
