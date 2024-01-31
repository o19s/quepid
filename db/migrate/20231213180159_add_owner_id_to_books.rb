class AddOwnerIdToBooks < ActiveRecord::Migration[7.1]
  def change
    add_column :books, :owner_id, :integer
    
    AddOwnerIdToBooks.connection.execute(
      "
      UPDATE books
      SET owner_id = (
            SELECT tm.member_id
            FROM teams_books tb, teams_members tm
            WHERE tb.book_id = books.id
            AND tb.team_id = tm.team_id
            LIMIT 1
      );
      "
    )      
  end
end
