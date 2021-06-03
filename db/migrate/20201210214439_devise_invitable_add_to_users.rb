class DeviseInvitableAddToUsers < ActiveRecord::Migration[5.2]
  def up
    change_table :users do |t|
      t.string     :invitation_token
      t.datetime   :invitation_created_at
      t.datetime   :invitation_sent_at
      t.datetime   :invitation_accepted_at
      t.integer    :invitation_limit
      #t.references :invited_by, polymorphic: true
      t.integer    :invited_by_id # working aroudn the polymorphic throwing errors.
      t.integer    :invitations_count, default: 0
      # Had to customize this from the default Devise Invitable script to add a length: 191
      t.index      :invitation_token, unique: true, length: { invitation_token: 191 } # for invitable
      t.index      :invited_by_id
    end
  end

  def down
    change_table :users do |t|
      t.remove_references :invited_by, polymorphic: true
      t.remove :invitations_count, :invitation_limit, :invitation_sent_at, :invitation_accepted_at, :invitation_token, :invitation_created_at
    end
  end
end
