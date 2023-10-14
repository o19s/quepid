# frozen_string_literal: true

for_sharing ||= false

json.id           team.id
json.name         team.name
json.owner_id     team.owner_id
json.owned        team.owner_id == current_user.id
json.cases_count  team.cases.not_archived.count

json.scorers do
  json.array! team.scorers, partial: 'api/v1/scorers/scorer', as: :scorer
end

json.cases do
  # rubocop:disable Layout/LineLength
  json.array! team.cases.not_archived, partial: 'api/v1/cases/case', as: :acase, locals: { shallow: true, no_teams: for_sharing, no_tries: for_sharing }
  # rubocop:enable Layout/LineLength
end

unless for_sharing
  json.members do
    json.array! team.members, partial: 'api/v1/team_members/member', as: :member
  end

  json.books do
    json.array! team.books, partial: 'api/v1/team_books/book', as: :book
  end

  json.search_endpoints do
    json.array! team.search_endpoints, partial: 'api/v1/search_endpoints/search_endpoint', as: :search_endpoint
  end
  json.owner do
    json.id             team.owner.id
    json.display_name   team.owner.display_name
    json.email          team.owner.email
    json.avatar_url     team.owner.avatar_url(:big)
  end

end
