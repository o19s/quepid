class CreateBooksJoinTable < ActiveRecord::Migration[7.1]
  def change    
    create_join_table :books, :teams, table_name: :teams_books do |t|
    end    
    
    CreateBooksJoinTable.connection.execute(
      "
      insert into teams_books (team_id, book_id) select team_id, id from books
      "
    )
    
    remove_column :books, :team_id
    
  end
end
