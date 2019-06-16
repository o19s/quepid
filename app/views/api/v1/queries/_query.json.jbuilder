# frozen_string_literal: true

json.arrangedAt         query.arranged_at
json.arrangedNext       query.arranged_next
json.deleted            query.deleted
json.queryId            query.id
json.query_text         query.query_text
json.scorerEnbl         query.scorer_enbl
json.scorerId           query.scorer_id
json.threshold          query.threshold
json.thresholdEnabled   query.threshold_enbl
json.options            query.options
json.notes              query.notes

json.test               query.test, partial: 'api/v1/scorers/scorer', as: :scorer if query.test.present?

if query.scorer.present?
  path = "api/v1/#{query.scorer.class.table_name}/scorer"
  json.scorer query.scorer, partial: path, as: :scorer
end

json.ratings do
  query.ratings.each { |rating| json.set! rating.doc_id, rating.rating }
end
