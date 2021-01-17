# frozen_string_literal: true

load_cases ||= false
json.id           team.id
json.name         team.name
json.owner_id     team.owner_id
json.owned        team.owner_id == current_user.id
json.cases_count  team.cases.count

json.scorers do
  json.array! team.scorers, partial: 'api/v1/scorers/scorer', as: :scorer
end

json.members team.members do |member|
  json.id             member.id
  json.display_name   member.display_name
  json.email          member.email
  json.avatar_url     member.avatar_url(:big)
  json.pending_invite member.created_by_invite? && !member.invitation_accepted?
end

if load_cases
  json.cases do
    # rubocop:disable Layout/LineLength
    json.array! team.cases, partial: 'api/v1/cases/case', as: :acase, locals: { shallow: true, no_teams: true, no_tries: true }
    # rubocop:enable Layout/LineLength
  end
end

json.owner do
  json.id             team.owner.id
  json.display_name   team.owner.display_name
  json.email          team.owner.email
  json.avatar_url     team.owner.avatar_url(:big)
end
