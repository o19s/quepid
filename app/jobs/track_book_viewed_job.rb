# frozen_string_literal: true

class TrackBookViewedJob < ApplicationJob
  queue_as :default

  def perform user, book
    return if book.nil?

    metadatum = book.metadata.find_or_create_by user: user

    metadatum.update last_viewed_at: Time.zone.now
  end
end
