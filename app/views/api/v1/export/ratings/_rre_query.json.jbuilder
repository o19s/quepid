# frozen_string_literal: true

json.placeholders do
  json.set!('$query', query.query_text)
end

json.relevant_documents do
  query.ratings.fully_rated.each do |r|
    json.set!(r.doc_id, { gain: r.rating.to_i } )
  end
end
