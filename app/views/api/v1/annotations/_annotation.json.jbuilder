# frozen_string_literal: true

json.id         annotation.id
json.user_id    annotation.user_id
json.message    annotation.message
json.source     annotation.source
json.created_at annotation.created_at
json.updated_at annotation.updated_at

json.score do
  json.partial! '/api/v1/case_scores/score', score: annotation.score, shallow: true
end

json.user do
  json.name annotation.user.display_name
end
