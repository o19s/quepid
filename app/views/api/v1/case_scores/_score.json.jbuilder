# frozen_string_literal: true

shallow ||= false

json.all_rated  score.all_rated
json.case_id    score.case_id
json.created_at score.created_at
json.id         score.id
json.score      score.score
json.shallow    shallow
json.try_id     score.try_id
json.updated_at score.updated_at
json.user_id    score.user_id
json.email      score.user&.email

json.queries score.queries unless shallow

if score.annotation
  json.note score.annotation.message
else
  json.note nil
end
