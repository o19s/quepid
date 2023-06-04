class AddIndexToJudgementsOnUserAndQueryDocPair < ActiveRecord::Migration[7.0]
  def change
    add_index :judgements, [:user_id, :query_doc_pair_id], unique: true  
  end
end
