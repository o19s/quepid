# frozen_string_literal: true

json.arrangedAt         query.arranged_at
json.arrangedNext       query.arranged_next
json.queryId            query.id
json.query_text         query.query_text
json.threshold          query.threshold
json.thresholdEnabled   query.threshold_enbl
json.options            query.options
json.notes              query.notes

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

json.rating_variance query.relative_variance

json.ratings do
  ratings.each { |rating| json.set! rating.doc_id, rating.rating }
end
