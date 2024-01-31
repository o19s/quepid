class CreateBooksMetadata < ActiveRecord::Migration[7.1]
  def change
    create_table :book_metadata do |t|
      #t.references :user, null: false, foreign_key: true
      t.integer :user_id
      t.references :book, null: false, foreign_key: true
      t.datetime :last_viewed_at
    end
    
    add_index :book_metadata, [:user_id, :book_id]
    
  end
end
