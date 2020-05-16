json.queries do
  json.array! @case.queries, partial: 'query', as: :query
end
