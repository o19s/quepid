# frozen_string_literal: true

json.query_text         query.query_text
json.options            query.options
json.notes              query.notes
json.information_need   query.information_need

json.ratings do
  json.array! query.ratings, partial: 'rating', as: :rating
end
