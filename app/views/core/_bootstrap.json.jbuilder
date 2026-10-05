# frozen_string_literal: true

json.user do
  json.partial! 'api/v1/users/current_user', user: current_user
end
json.case do
  # The graph owns score loading. All tries are needed by Tune Relevance history.
  json.partial! 'api/v1/cases/case', acase: @case, shallow: true, no_scores: true
  json.tries do
    tries = @case.tries.includes(:curator_variables, :search_endpoint)
    json.array! tries, partial: 'api/v1/tries/try', as: :try, no_endpoint: true
  end
end
