# frozen_string_literal: true

class TrackBookViewedJob < ApplicationJob
  queue_as :default
  discard_on ActiveJob::DeserializationError

  def perform user_id, book_id
    user = User.find_by(id: user_id)
    book = Book.find_by(id: book_id)
    return if user.nil? || book.nil?

    metadatum = book.metadata.find_or_create_by user: user

    metadatum.update last_viewed_at: Time.zone.now
  end
end
