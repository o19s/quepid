class AddUsersIdUsersInvitedByIdFk < ActiveRecord::Migration[8.0]
  def change
    add_foreign_key :users, :users, column: :invited_by_id, primary_key: :id
  end
end
