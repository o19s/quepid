# frozen_string_literal: true

json.query_id           query.id
json.query_text         query.query_text
json.options            query.options
json.notes              query.notes
json.information_need   query.information_need

# Rendered with the case's embedder (pass `embedder:`, nil for none): whether the
# query's vector matches it -- see QueryVectorStatus. Omitted when not asked for.
if local_assigns.key?(:embedder)
  vector_status = query.vector_status(embedder)
  json.vector_status        vector_status.status
  json.vector_status_reason vector_status.reason
end

# pick the most recent update between a query and it's ratings to represent modified_at
json.modified_at [ query, query.ratings ].flatten.max_by(&:updated_at).updated_at

json.ratings do
  query.ratings.each { |rating| json.set! rating.doc_id, rating.rating }
end
