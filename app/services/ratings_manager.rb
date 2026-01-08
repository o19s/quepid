# frozen_string_literal: true

class RatingsManager
  attr_accessor :book, :queries_created, :ratings_created, :options

  def initialize book, opts = {}
    default_options = {
      create_missing_queries: false,
    }

    @options = default_options.merge(opts.deep_symbolize_keys)

    @book = book
    @queries_created = 0
    @ratings_created = 0

    @counter = 0
  end

  def sync_ratings_for_query_doc_pair query_doc_pair
    @book.cases.each do |kase|
      sync_judgements_to_ratings kase, query_doc_pair
    end
  end

  def sync_ratings_for_case kase
    @book.query_doc_pairs.each do |query_doc_pair|
      sync_judgements_to_ratings kase, query_doc_pair
    end

    broadcast_completion_notifications kase, kase.queries.size
  end

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  def sync_judgements_to_ratings kase, query_doc_pair
    @counter += 1
    query = Query.find_or_initialize_by(case: kase, query_text: query_doc_pair.query_text)

    return if query.new_record? && !options[:create_missing_queries]

    if query.new_record?
      query.information_need = query_doc_pair.information_need
      query.notes = query_doc_pair.notes
      query.options = query_doc_pair.options

      @queries_created += 1
    end

    query.save

    # Turbo::StreamsChannel.broadcast_render_to(
    #   :notifications,
    #   target:  'notifications',
    #   partial: 'books/notification',
    #   locals:  { book: book, message: "Starting to export book #{book.name}", progress: 33 }
    # )
    broadcast_case_specific_notification kase, query_doc_pair, @book.query_doc_pairs.size, @counter

    judgements = query_doc_pair.judgements.rateable

    # only calculate this if we have valid judgements.  If everything is unrateable, then don't proceed.
    if judgements.any?
      calculated_rating = calculate_rating_from_judgements(judgements)

      rating = Rating.find_or_initialize_by(query: query, doc_id: query_doc_pair.doc_id)
      rating.rating = if @book.support_implicit_judgements?
                        calculated_rating
                      else
                        # explicit judgements only work with integers.
                        calculated_rating.round
                      end

      @ratings_created += 1 if rating.new_record?

      rating.save
    end
  end

  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength
  # Calculates a rating from multiple judgements using an optimistic-pessimistic approach:
  # 1. If only 1-2 judgements exist, average them (not enough data for consensus)
  # 2. Take the three highest ratings (optimistic: assume the best judges rated highest)
  # 3. If those judges agree, use that value
  # 4. If they disagree, use the minimum of the top three (pessimistic: trust the lower rating,
  #    assuming judges tend to overrate)
  #
  # @param judgements [ActiveRecord::Relation] Collection of rateable judgements
  # @return [Float] The calculated rating
  def calculate_rating_from_judgements judgements
    ratings = judgements.map(&:rating).sort.reverse

    # With fewer than 3 judgements, just average them
    return ratings.sum / ratings.size if ratings.size < 3

    # Take the top 3 ratings
    top_ratings = ratings.first(3)

    # If all top ratings agree, use that value
    # Otherwise, use the minimum (trust the pessimistic judge)
    if 1 == top_ratings.uniq.size
      top_ratings.first
    else
      top_ratings.min
    end
  end

  def broadcast_case_specific_notification acase, query_doc_pair, query_doc_pair_count, counter
    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  "notifications-case-#{acase.id}",
      partial: 'admin/run_case/notification_case_sync',
      locals:  { acase: acase, query_doc_pair: query_doc_pair, query_doc_pair_count: query_doc_pair_count, counter: counter }
    )
  end

  def broadcast_completion_notifications acase, query_count
    broadcast_case_specific_notification(acase, nil, query_count, -1)
  end
end
