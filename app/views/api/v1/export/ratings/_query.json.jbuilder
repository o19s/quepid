# frozen_string_literal: true

json.query query.query_text
json.ratings do
  query.ratings.each { |rating| json.set! rating.doc_id, rating.rating }
end
