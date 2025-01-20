# frozen_string_literal: true

json.arranged_at        query.arranged_at
json.arranged_next      query.arranged_next
json.query_text         query.query_text
json.options            query.options
json.notes              query.notes
json.information_need   query.information_need

json.ratings do
  json.array! query.ratings, partial: 'rating', as: :rating
end
