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
      .select { |job| job_targets_book?(job, book) }
  end

  def self.actively_syncing? book, kase
    active_for(book, kase).any?
  end

  def self.job_targets_book? job, book
    args = job.arguments['arguments'] || []
    qdp_arg = args.find { |a| a.is_a?(Hash) && a['_aj_globalid']&.include?('/QueryDocPair/') }
    return false unless qdp_arg

    GlobalID::Locator.locate(qdp_arg['_aj_globalid'])&.book_id == book.id
  end
  private_class_method :job_targets_book?

  # Fired after every judgement save (human, bulk, or AI) - the dominant
  # path for Book -> Case ratings syncing, unlike the bulk/explicit
  # UpdateCaseJob. Broadcasting here (rather than at each call site) keeps
  # the Linked Cases card's pulse live for all three judging flows.
  def perform query_doc_pair
    service = RatingsManager.new(query_doc_pair.book)
    service.sync_ratings_for_query_doc_pair query_doc_pair
    BroadcastLinkedCasesJob.perform_later(query_doc_pair.book)
  end
end
