class MakeUserCaseRelationshipAnOwner < ActiveRecord::Migration[5.2]
  def change
    rename_column :cases, :user_id, :owner_id
  end
end
