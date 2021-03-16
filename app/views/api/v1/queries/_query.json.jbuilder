# frozen_string_literal: true

json.arrangedAt         query.arranged_at
json.arrangedNext       query.arranged_next
json.deleted            query.deleted
json.queryId            query.id
json.query_text         query.query_text
json.threshold          query.threshold
json.thresholdEnabled   query.threshold_enbl
json.options            query.options
json.notes              query.notes

json.ratings do
  query.ratings.each { |rating| json.set! rating.doc_id, rating.rating }
end
