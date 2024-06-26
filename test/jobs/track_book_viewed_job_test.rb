# frozen_string_literal: true

require 'test_helper'

class TrackBookViewedJobTest < ActiveJob::TestCase
  let(:doug)                  { users(:doug) }
  let(:matt)                  { users(:matt) }
  let(:book) { books(:book_of_star_wars_judgements) }

  test 'creates a new metadatum when one does not exist' do
    assert_equal      0, book.metadata.where(user: matt).count

    assert_difference 'book.metadata.where(user: matt).count', 1 do
      perform_enqueued_jobs do
        TrackBookViewedJob.perform_now(matt, book)
      end
    end

    assert_equal 1, book.metadata.where(user: matt).count
  end

  test 'updates existing metadatum and does not create a new one' do
    assert book.metadata.where(user: doug).first.last_viewed_at < DateTime.current

    assert_difference 'book.metadata.where(user: doug).count', 0 do
      perform_enqueued_jobs do
        TrackBookViewedJob.perform_now(doug, book)
      end
    end

    assert_equal 1, book.metadata.where(user: doug).count
  end
end
