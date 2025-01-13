# frozen_string_literal: true

class JudgementFromRatingJob < ApplicationJob
  queue_as :default

  def perform user, rating
    query = rating.query
    book = query.case.book
    if book
      query_doc_pair = book.query_doc_pairs.find_or_create_by query_text: rating.query.query_text, doc_id: rating.doc_id

      judgement = query_doc_pair.judgements.find_or_initialize_by(user: user)
      judgement.rating = rating.rating
      judgement.save!
    end
  end
end
