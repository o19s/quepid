# frozen_string_literal: true

shallow ||= true

json.id             team.id
json.name           team.name
json.owner_id       team.owner_id
json.owned          team.owner_id == current_user.id
json.cases_count    team.cases.not_archived.size
json.members_count  team.members.size

json.cases do
  # rubocop:disable Layout/LineLength
  json.array! team.cases.not_archived, partial: 'api/v1/cases/case', as: :acase, locals: { shallow: shallow, no_queries: true, no_scores: true, no_teams: true, no_tries: true }
  # rubocop:enable Layout/LineLength
end

json.scorers do
  json.array! team.scorers, partial: 'api/v1/scorers/scorer', as: :scorer
end

unless shallow

  json.members do
    json.array! team.members, partial: 'api/v1/team_members/member', as: :member
  end

  json.books do
    json.array! team.books, partial: 'api/v1/team_books/book', as: :book
  end

  json.search_endpoints do
    json.array! team.search_endpoints.not_archived, partial: 'api/v1/search_endpoints/search_endpoint',
                                                    as:      :search_endpoint
  end
  json.owner do
    json.id             team.owner.id
    json.display_name   team.owner.display_name
    json.email          team.owner.email
    json.avatar_url     team.owner.avatar_url(:big)
  end

end
