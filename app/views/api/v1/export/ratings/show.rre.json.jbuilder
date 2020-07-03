# frozen_string_literal: true

json.set!('id_field', @case.tries.latest.id_from_field_spec)
json.set!('index', @case.tries.latest.index_name_from_search_url)
json.set!('template', 'template.json')

json.queries do
  json.array! @case.queries, partial: 'rre_query', as: :query
end
