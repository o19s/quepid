# frozen_string_literal: true

json.set!('id_field', @case.tries.latest.id_from_field_spec)
json.set!('index', @case.case_name)
json.set!('template', 'quepid.json')

json.queries do
  json.array! @case.queries, partial: 'rre_query', as: :query
end
