# frozen_string_literal: true

json.case_name        acase.case_name
json.owned            acase.owner_id == current_user.id if current_user.present?
json.owner_email      acase.owner.email if acase.owner.present?
json.public           acase.public
json.archived         acase.archived
json.options          acase.options

if acase.scorer.present?
  json.scorer do
    json.partial! 'api/v1/scorers/scorer', scorer: acase.scorer, export: true
  end
end

json.queries do
  json.array! acase.queries, partial: 'query', as: :query
end

unless acase.tries.empty?
  json.try do
    json.partial! 'try', try: acase.tries.first
  end
end
