class CreateJudgements < ActiveRecord::Migration[6.1]
  def change
    create_table :judgements do |t|
      t.integer :user_id
      t.float :rating
      t.references :query_doc_pair, null: false, foreign_key: true

      t.timestamps
    end
  end
end
