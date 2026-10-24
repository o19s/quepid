# frozen_string_literal: true

class RatingCollection < QuepidCollection
  model Rating
  description 'One case-side relevance rating of a document for a query.'
  fields :id, :doc_id, :rating, :query, :created_at, :updated_at

  computed :user_id, :integer, sql: '{table}.user_id', doc: 'id of the rater (no user collection)'

  instructions <<~TXT
    One relevance judgement of one document for one query, on the CASE side. Not the same as
    "judgement" (the book side). "doc_id" is the search engine's document id. "rating" is on the
    case scorer's scale (commonly 0-3), so compare ratings only within one case.
  TXT

  def scope_for user
    Rating.joins(:query).where(queries: { case_id: visible_case_ids(user) })
  end
end
