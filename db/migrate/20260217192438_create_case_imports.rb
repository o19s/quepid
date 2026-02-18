class CreateCaseImports < ActiveRecord::Migration[8.1]
  def change
    create_table :case_imports do |t|
      t.integer :case_id, null: false
      t.integer :user_id, null: false
      t.index :case_id
      t.index :user_id
      t.foreign_key :cases, column: :case_id
      t.foreign_key :users, column: :user_id
      t.json :import_params
      t.string :status

      t.timestamps
    end
  end
end
