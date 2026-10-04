# frozen_string_literal: true

class UpdateCaseRatingsJob < ApplicationJob
  queue_as :default

  def perform query_doc_pair
    ids = query_doc_pair.is_a?(Array) ? query_doc_pair : [ query_doc_pair.id ]
    QueryDocPair.where(id: ids).includes(:book).find_each do |pair|
      RatingsManager.new(pair.book).sync_ratings_for_query_doc_pair(pair)
    end
  end
end
