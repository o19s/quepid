# frozen_string_literal: true

json.placeholders do
  json.set!('$query', query.query_text)
end

grouped_ratings = {}

query.ratings.fully_rated.each do |r|
  # rubocop:disable Style/IfUnlessModifier
  unless grouped_ratings.key?(r.rating)
    grouped_ratings[r.rating] = []
  end
  # rubocop:enable Style/IfUnlessModifier
  grouped_ratings[r.rating] << r.doc_id
end

json.relevant_documents do
  grouped_ratings.sort.to_h.each do |key, value|
    json.set!(key, value)
  end
end
