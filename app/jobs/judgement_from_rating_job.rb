# frozen_string_literal: true

class JudgementFromRatingJob < ApplicationJob
  queue_as :default

  def perform user, rating
    ids = rating.is_a?(Array) ? rating : [ rating.id ]
    JudgementSync.batch do
      Rating.where(id: ids).includes(query: :case).find_each do |item|
        book = item.query.case.book
        next unless book

        pair = book.find_or_initialize_query_doc_pair(query_text: item.query.query_text, doc_id: item.doc_id)
        pair.save!
        judgement = pair.judgements.find_or_initialize_by(user: user)
        judgement.rating = item.rating
        judgement.save!
      end
    end
  end
end
