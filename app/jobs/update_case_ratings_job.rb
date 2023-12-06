# frozen_string_literal: true

class UpdateCaseRatingsJob < ApplicationJob
  queue_as :default

  def perform judgement
    query_doc_pair = judgement.query_doc_pair
    book = judgement.query_doc_pair.book

    judgement.query_doc_pair.book.cases.each do |kase|
      query = Query.find_or_initialize_by(case: kase, query_text: query_doc_pair.query_text)

      count_of_judgements = query_doc_pair.judgements.rateable.size
      # only calculate this if we have valid judgements.  If everything is unrateable, then don't proceed.
      next unless count_of_judgements.positive?

      summed_rating = query_doc_pair.judgements.rateable.sum(&:rating)
      rating = Rating.find_or_initialize_by(query: query, doc_id: query_doc_pair.doc_id)

      rating.rating = if book.support_implicit_judgements?
                        summed_rating / count_of_judgements
                      else
                        # explicit judgements only work with integers.
                        (summed_rating / count_of_judgements).round
                      end
      rating.save
      query.save
    end
  end
end
