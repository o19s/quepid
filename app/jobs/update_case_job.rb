# frozen_string_literal: true

class UpdateCaseJob < ApplicationJob
  queue_as :default

  # Supports two scenarios:
  # 1. Update all cases for a book: UpdateCaseJob.perform_later(book_id, options)
  # 2. Update specific case: UpdateCaseJob.perform_later(book_id, options, case_id)
  def perform book, options = {}, specific_case = nil
    service = RatingsManager.new(book, options)

    @counts = {
      'queries_created' => 0,
      'ratings_created' => 0,
    }
    kases_to_sync = specific_case.present? ? [ specific_case ] : book.cases

    kases_to_sync.each do |kase|
      service.sync_ratings_for_case(kase)
      @counts['queries_created'] += service.queries_created
      @counts['ratings_created'] = + service.ratings_created
    end
    @counts
  end
end
