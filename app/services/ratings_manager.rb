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
    @book.cases.where(auto_populate_case_judgements: true).includes(:owner).find_each do |kase|
      sync_judgements_to_ratings kase, query_doc_pair
    end
  end

  def sync_ratings_for_case kase
    @book.query_doc_pairs.each do |query_doc_pair|
      sync_judgements_to_ratings kase, query_doc_pair
    end

    broadcast_completion_notifications kase, kase.queries.size
  end

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

    # A merge that gives no rating (e.g. every judgement is unrateable) leaves the existing rating alone.
    merged_rating = judgement_merger.rating_for(query_doc_pair.judgements.rateable)
    return if merged_rating.nil?

    rating = Rating.find_or_initialize_by(query: query, doc_id: query_doc_pair.doc_id)
    rating.rating = merged_rating

    @ratings_created += 1 if rating.new_record?

    rating.save
  end

  def judgement_merger
    @judgement_merger ||= JudgementMerger.new(@book)
  end

  def broadcast_case_specific_notification acase, query_doc_pair, query_doc_pair_count, counter
    ProgressBroadcaster.render(
      acase,
      target:  "notifications-case-#{acase.id}",
      partial: 'admin/run_case/notification_case_sync',
      locals:  { acase: acase, query_doc_pair: query_doc_pair, query_doc_pair_count: query_doc_pair_count, counter: counter }
    )
  end

  def broadcast_completion_notifications acase, query_count
    broadcast_case_specific_notification(acase, nil, query_count, -1)
  end
end
