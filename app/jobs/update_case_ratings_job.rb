# frozen_string_literal: true

class UpdateCaseRatingsJob < ApplicationJob
  queue_as :default

  def perform query_doc_pair
    service = RatingsManager.new(query_doc_pair.book)
    service.sync_ratings_for_query_doc_pair query_doc_pair
  end
end
