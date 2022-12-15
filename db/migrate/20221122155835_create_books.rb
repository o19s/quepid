class CreateBooks < ActiveRecord::Migration[6.1]
  def change
    create_table :books do |t|
      t.integer :team_id
      t.integer :scorer_id
      t.references :selection_strategy, null: false, foreign_key: true
      t.string :name

      t.timestamps
    end
  end
end
