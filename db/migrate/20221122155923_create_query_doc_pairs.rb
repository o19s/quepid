class CreateQueryDocPairs < ActiveRecord::Migration[6.1]
  def change
    create_table :query_doc_pairs do |t|
      t.integer :user_id
      t.string :query_text
      t.float :rank
      t.text :document_fields
      t.references :book, null: false, foreign_key: true

      t.timestamps
    end
  end
end