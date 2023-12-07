# frozen_string_literal: true

class RatingsManager
  attr_accessor :book, :query_count, :rating_count

  def initialize book
    @book = book
    @query_count = 0
    @rating_count = 0
  end

  def sync_ratings_for_query_doc_pair query_doc_pair
    @book.cases.each do |kase|
      query = Query.find_or_initialize_by(case: kase, query_text: query_doc_pair.query_text)

      count_of_judgements = query_doc_pair.judgements.rateable.size
      # only calculate this if we have valid judgements.  If everything is unrateable, then don't proceed.
      next unless count_of_judgements.positive?

      summed_rating = query_doc_pair.judgements.rateable.sum(&:rating)
      rating = Rating.find_or_initialize_by(query: query, doc_id: query_doc_pair.doc_id)
      rating.user = query_doc_pair.judgements.last.user if rating.user.nil?

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

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/PerceivedComplexity
  def sync_ratings_for_case kase
    @book.rated_query_doc_pairs.each do |query_doc_pair|
      query = Query.find_or_initialize_by(case: kase, query_text: query_doc_pair.query_text)

      count_of_judgements = query_doc_pair.judgements.rateable.size
      summed_rating = query_doc_pair.judgements.rateable.sum(&:rating)
      # only calculate this if we have valid judgements.  If everything is unrateable, then don't proceed.
      next unless count_of_judgements.positive?

      rating = Rating.find_or_initialize_by(query: query, doc_id: query_doc_pair.doc_id)
      rating.user = query_doc_pair.judgements.last.user if rating.user.nil?
      rating.rating = if @book.support_implicit_judgements?
                        summed_rating / count_of_judgements
                      else
                        # explicit judgements only work with integers.
                        (summed_rating / count_of_judgements).round
                      end

      @query_count += 1 if query.new_record?
      @rating_count += 1 if rating.new_record?

      rating.save
      query.save
    end
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/PerceivedComplexity
end
