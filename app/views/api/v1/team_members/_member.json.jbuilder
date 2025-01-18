# frozen_string_literal: true

json.id member.id
json.display_name   member.display_name
json.email          member.email
json.avatar_url     member.avatar_url(:big)
json.ai_judge       member.ai_judge?
json.pending_invite member.pending_invite?
if member.pending_invite?
  json.invite_url accept_invitation_url(member, invitation_token: member.stored_raw_invitation_token)
end
