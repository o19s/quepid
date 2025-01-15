class AddIndexesToCasesTables < ActiveRecord::Migration[8.0]
  def change
    add_index :cases, [:owner_id, :archived], 
      name: 'idx_owner_archived'

    add_index :teams_members, [:member_id, :team_id], 
      name: 'idx_member_team'

    add_index :case_metadata, [:last_viewed_at, :case_id], 
      name: 'idx_last_viewed_case'
  end
end
