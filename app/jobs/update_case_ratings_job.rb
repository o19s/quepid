# frozen_string_literal: true

class UpdateCaseRatingsJob < ApplicationJob
  queue_as :default

  # Whether an in-flight (not finished) SolidQueue row for this job class has a
  # query_doc_pair in the given book. Unlike UpdateCaseJob, this job's only
  # argument is a query_doc_pair - there's no book or case GlobalID serialized
  # directly, so each candidate job's query_doc_pair has to be resolved to find
  # its book. RatingsManager#sync_ratings_for_query_doc_pair applies to every
  # case on that book with auto_populate_case_judgements enabled (no per-case
  # filtering), so the answer is per book: a list of linked cases checks the
  # queue once, and applies it to each case with that flag set.
  def self.actively_syncing_book? book
    pending_jobs.any? { |job| job_targets_book?(job, book) }
  end

  def self.pending_jobs
    SolidQueue::Job
      .where(class_name: name, finished_at: nil)
      .where.missing(:failed_execution)
  end
  private_class_method :pending_jobs

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
    books = {}
    QueryDocPair.where(id: ids).includes(:book).find_each do |pair|
      RatingsManager.new(pair.book).sync_ratings_for_query_doc_pair(pair)
      books[pair.book_id] = pair.book
    end
    books.each_value { |book| BroadcastLinkedCasesJob.perform_later(book) }
  end
end
