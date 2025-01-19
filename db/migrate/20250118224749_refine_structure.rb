# RedundantIndexChecker fail Case user_id index is redundant as idx_owner_archived covers it

class RefineStructure < ActiveRecord::Migration[8.0]
  def change
    if index_exists?(:cases, [:user_id, :archived], name: 'idx_owner_archived')
      remove_index :cases, :user_id if index_exists?(:cases, :user_id)
    end
    
  end
end
