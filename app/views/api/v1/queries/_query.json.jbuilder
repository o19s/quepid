# frozen_string_literal: true

# [doc_id, rating, updated_at] rows.  Callers rendering a whole case pass ratings_by_query
# (from Rating.rows_by_query) so the ratings aren't loaded as Active Record objects.
ratings_by_query = local_assigns[:ratings_by_query]
ratings = if ratings_by_query
            ratings_by_query.fetch(query.id, [])
          else
            query.ratings.map { |rating| [ rating.doc_id, rating.rating, rating.updated_at ] }
          end

json.query_id           query.id
json.query_text         query.query_text
json.options            query.options
json.notes              query.notes
json.information_need   query.information_need

# pick the most recent update between a query and it's ratings to represent modified_at
json.modified_at [ query.updated_at, *ratings.map(&:last) ].max

json.ratings do
  ratings.each { |doc_id, rating, _updated_at| json.set! doc_id, rating }
end
