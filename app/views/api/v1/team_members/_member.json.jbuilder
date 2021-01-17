# frozen_string_literal: true

json.id member.id
json.display_name   member.display_name
json.email          member.email
json.avatar_url     member.avatar_url(:big)
json.pending_invite member.created_by_invite? && !member.invitation_accepted?
