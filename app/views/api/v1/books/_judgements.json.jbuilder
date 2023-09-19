# frozen_string_literal: true

json.judgement_id   judgement.id unless export
json.rating         judgement.rating
json.unrateable     judgement.unrateable
json.user_id        judgement.user_id unless export
if judgement.user && export
  json.user_email judgement.user.email
  json.user_name judgement.user.name
end
