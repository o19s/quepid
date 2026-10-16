# frozen_string_literal: true

class UpdateCaseRatingsJob < ApplicationJob
  queue_as :default

  # Finds in-flight (not finished) SolidQueue rows for this job class whose
  # query_doc_pair belongs to the given book. Unlike UpdateCaseJob, this
  # job's only argument is a query_doc_pair - there's no book or case
  # GlobalID serialized directly, so each candidate job's query_doc_pair has
  # to be resolved to find its book. RatingsManager#sync_ratings_for_query_doc_pair
  # applies to every case on that book with auto_populate_case_judgements
  # enabled (no per-case filtering), so a running job for the book covers
  # kase whenever that flag is set.
  def self.active_for book, kase
    return [] unless kase.auto_populate_case_judgements?

    SolidQueue::Job
      .where(class_name: name, finished_at: nil)
      .where.missing(:failed_execution)
      .select { |job| job_targets_book?(job, book) }
  end

  def self.actively_syncing? book, kase
    active_for(book, kase).any?
  end

  def self.job_targets_book? job, book
    args = job.arguments['arguments'] || []
    ids = args.first
    if ids.is_a?(Array)
      QueryDocPair.exists?(id: ids, book_id: book.id)
    else
      qdp_arg = args.find { |arg| arg.is_a?(Hash) && arg['_aj_globalid']&.include?('/QueryDocPair/') }
      qdp_arg && safely_locate(qdp_arg['_aj_globalid'])&.book_id == book.id
    end
  end
  private_class_method :job_targets_book?

  def perform query_doc_pair
    ids = query_doc_pair.is_a?(Array) ? query_doc_pair : [ query_doc_pair.id ]
    QueryDocPair.where(id: ids).includes(:book).find_each do |pair|
      RatingsManager.new(pair.book).sync_ratings_for_query_doc_pair(pair)
      BroadcastLinkedCasesJob.perform_later(pair.book)
    end
  end
end
