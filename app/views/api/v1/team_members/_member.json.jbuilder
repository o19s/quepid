# frozen_string_literal: true

json.id member.id
json.display_name   member.display_name
json.email          member.email
json.avatar_url     member.avatar_url(:big)
json.pending_invite member.created_by_invite? && !member.invitation_accepted?
if member.created_by_invite? && !member.invitation_accepted?
  json.invite_url accept_invitation_url(member, invitation_token: member.stored_raw_invitation_token)
end
