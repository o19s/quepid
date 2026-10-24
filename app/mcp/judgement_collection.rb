# frozen_string_literal: true

class JudgementCollection < QuepidCollection
  model Judgement
  description "One rater's verdict on one book query/document pair."
  fields :id, :rating, :unrateable, :judge_later, :explanation, :query_doc_pair,
         :created_at, :updated_at

  computed :user_id, :integer, sql: '{table}.user_id',
                               doc: 'id of the rater; may be an AI judge (see the ai_judge collection)'

  instructions <<~TXT
    One rater's verdict on one query/document pair, on the BOOK side. Not the same as "rating"
    (the case side). "rating" is on the book's scale, null when the pair was skipped.
    "unrateable" and "judge_later" mark pairs the rater could not judge or deferred.
  TXT

  def scope_for user
    Judgement.joins(:query_doc_pair).where(query_doc_pairs: { book_id: visible_book_ids(user) })
  end
end
