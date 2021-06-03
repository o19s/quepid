class AddStoredRawInvitationTokenToUser < ActiveRecord::Migration[5.2]
  def change
    add_column :users, :stored_raw_invitation_token, :string
  end
end
