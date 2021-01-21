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

if @case_metadatum.present?
  if @case_metadatum.individual_ratings_view?
    ratings = query.ratings.where(user_id: @case_metadatum.user_id)
  elsif @case_metadatum.consolidated_ratings_view?
    ratings = Query.ratings_averaged(query.ratings)
  end
else
  # Average out the ratings if we don't have a specific user
  ratings = Query.ratings_averaged(query.ratings)
end

# rubocop:disable Layout/LineLength
# json.rating_variance Query.relative_variance(query.case.scorer.scale.last, Query.ratings_averaged(query.ratings).first.rating)
json.rating_variance query.relative_variance
# rubocop:enable Layout/LineLength

json.ratings do
  ratings.each { |rating| json.set! rating.doc_id, rating.rating }
end
