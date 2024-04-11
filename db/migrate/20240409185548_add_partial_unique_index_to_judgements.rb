class AddPartialUniqueIndexToJudgements < ActiveRecord::Migration[7.1]
  def change
    remove_index :judgements, [:user_id, :query_doc_pair_id]
    add_index :judgements, [:user_id, :query_doc_pair_id], unique: true, where: 'user_id IS NOT NULL'
  end
end
