# frozen_string_literal: true

class UpdateCaseJob < ApplicationJob
  queue_as :default

  # Finds the in-flight (not finished) SolidQueue rows for this job class
  # matching the given book + case. Mirrors RunJudgeJudyJob.active_for -
  # the Linked Cases card uses this to pulse a case's "receives ratings"
  # arrow while its Book -> Case sync is actively running. A bulk run
  # (no specific_case argument) doesn't name any case in its serialized
  # arguments, so it's treated as covering every case it would actually
  # touch: those with auto_populate_case_judgements enabled.
  def self.active_for book, kase
    book_gid = book.to_global_id.to_s
    kase_gid = kase.to_global_id.to_s
    SolidQueue::Job
      .where(class_name: name, finished_at: nil)
      .where('arguments LIKE ?', "%#{book_gid}%")
      .select { |job| job_covers_case?(job, book_gid, kase_gid, kase) }
  end

  def self.actively_syncing? book, kase
    active_for(book, kase).any?
  end

  def self.job_covers_case? job, book_gid, kase_gid, kase
    args = job.arguments['arguments'] || []
    return false unless args.any? { |a| a.is_a?(Hash) && a['_aj_globalid'] == book_gid }

    has_specific_case = args.any? { |a| a.is_a?(Hash) && a['_aj_globalid']&.include?('/Case/') }
    return args.any? { |a| a.is_a?(Hash) && a['_aj_globalid'] == kase_gid } if has_specific_case

    kase.auto_populate_case_judgements?
  end
  private_class_method :job_covers_case?

  # Supports two scenarios:
  # 1. Update all cases for a book: UpdateCaseJob.perform_later(book_id, options)
  # 2. Update specific case: UpdateCaseJob.perform_later(book_id, options, case_id)
  def perform book, options = {}, specific_case = nil
    service = RatingsManager.new(book, options)

    @counts = {
      'queries_created' => 0,
      'ratings_created' => 0,
    }
    kases_to_sync = if specific_case.present?
                      # Explicit manual refresh for a specific case — always run
                      [ specific_case ]
                    else
                      # Bulk update from book-level operations — respect the auto-populate flag
                      book.cases.where(auto_populate_case_judgements: true)
                    end

    BroadcastLinkedCasesJob.perform_later(book)

    kases_to_sync.each do |kase|
      service.sync_ratings_for_case(kase)
      @counts['queries_created'] += service.queries_created
      @counts['ratings_created'] = + service.ratings_created
    end

    BroadcastLinkedCasesJob.perform_later(book)
    @counts
  end
end
