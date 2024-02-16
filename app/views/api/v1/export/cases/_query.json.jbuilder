# frozen_string_literal: true

json.arranged_at        query.arranged_at
json.arranged_next      query.arranged_next
json.query_text         query.query_text
json.options            query.options
json.notes              query.notes
json.information_need   query.information_need

json.ratings do
  @case.doc_ratings_by_query[query.id]&.each { |rating| json.set! rating['doc_id'], rating['rating'] }
end
