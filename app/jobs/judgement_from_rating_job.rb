# frozen_string_literal: true

class JudgementFromRatingJob < ApplicationJob
  queue_as :default

  def perform user, rating
    query = rating.query
    book = query.case.book
    if book
      query_doc_pair = book.query_doc_pairs.find_or_create_by query_text: rating.query.query_text, doc_id: rating.doc_id

      # We can't populate the query_doc_pair.document_fields since we don't have that data
      # but there are other fields we CAN update.
      # query_doc_pair.document_fields = pair[:document_fields].to_json

      # We need to think about the difference between a query / rating and a query_doc_pair.
      # query_doc_pair.information_need = query.information_need
      # query_doc_pair.notes = query.notes
      # query_doc_pair.options = query.options

      query_doc_pair.save!

      judgement = query_doc_pair.judgements.find_or_initialize_by(user: user)
      judgement.rating = rating.rating
      judgement.save!
    end
  end
end
