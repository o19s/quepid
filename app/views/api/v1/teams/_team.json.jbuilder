# frozen_string_literal: true

shallow ||= false

json.id             team.id
json.name           team.name
json.cases_count    team.cases.not_archived.size
json.members_count  team.members.size

# Listing of individual cases and scorers is required to support the sharing of cases and scores in the core app
json.cases do
  json.array! team.cases.not_archived, partial: 'api/v1/cases/case', as: :acase, locals: { shallow: shallow, no_queries: true, no_scores: true, no_teams: true, no_tries: true }
end

json.scorers do
  json.array! team.scorers, partial: 'api/v1/scorers/scorer', as: :scorer
end

# Go deep to show all the details of a team
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
end
