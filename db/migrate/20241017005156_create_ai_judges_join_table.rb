class CreateAiJudgesJoinTable < ActiveRecord::Migration[7.2]
  def change
    create_table :ai_judges do |t|
      t.references :book, null: false, foreign_key: true
      # user doesn't have explicit fk because the id are different types
      t.references :user, null: false #, foreign_key: true 
      t.timestamps
    end

    add_index :ai_judges, [:book_id, :user_id], unique: true
  end
end
