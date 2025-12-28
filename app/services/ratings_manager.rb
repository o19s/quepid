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
  # rubocop:disable Metrics/PerceivedComplexity
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

    count_of_judgements = query_doc_pair.judgements.rateable.size

    # only calculate this if we have valid judgements.  If everything is unrateable, then don't proceed.
    if count_of_judgements.positive?
      summed_rating = query_doc_pair.judgements.rateable.sum(&:rating)

      rating = Rating.find_or_initialize_by(query: query, doc_id: query_doc_pair.doc_id)
      # I think the whole rating having a user was bogus becasue we have multiple raters
      # on the book side, which kind of messes this us.
      # rating.user = query_doc_pair.judgements.last.user if rating.user.nil?
      rating.rating = if @book.support_implicit_judgements?
                        summed_rating / count_of_judgements
                      else
                        # explicit judgements only work with integers.
                        (summed_rating / count_of_judgements).round
                      end

      @ratings_created += 1 if rating.new_record?

      rating.save

    end
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/PerceivedComplexity

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
