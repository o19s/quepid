# frozen_string_literal: true

class UpdateCaseJob < ApplicationJob
  queue_as :default

  def perform book
    service = RatingsManager.new(book)

    book.cases.each do |kase|
      service.sync_ratings_for_case(kase)
    end
  end
end
