# frozen_string_literal: true

json.rating_id        rating.id
json.query_text       rating.query.query_text
json.doc_id           rating.doc_id
json.rating           rating.rating
json.user_name        rating&.user&.fullname
