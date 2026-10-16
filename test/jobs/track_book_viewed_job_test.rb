# frozen_string_literal: true

require 'test_helper'

class TrackBookViewedJobTest < ActiveJob::TestCase
  let(:doug) { users(:doug) }
  let(:matt) { users(:matt) }
  let(:book) { books(:book_of_star_wars_judgements) }

  test 'creates a new metadatum when one does not exist' do
    assert_equal      0, book.metadata.where(user: matt).count

    assert_difference 'book.metadata.where(user: matt).count', 1 do
      perform_enqueued_jobs do
        TrackBookViewedJob.perform_now(matt.id, book.id)
      end
    end

    assert_equal 1, book.metadata.where(user: matt).count
  end

  test 'updates existing metadatum and does not create a new one' do
    assert_operator book.metadata.where(user: doug).first.last_viewed_at, :<, DateTime.current

    assert_difference 'book.metadata.where(user: doug).count', 0 do
      perform_enqueued_jobs do
        TrackBookViewedJob.perform_now(doug.id, book.id)
      end
    end

    assert_equal 1, book.metadata.where(user: doug).count
  end

  test 'ignores deleted users and books without failing' do
    deleted_user_id = User.create!(email: 'deleted-book-viewer@example.com', password: 'password', name: 'Deleted Viewer').id
    deleted_book_id = Book.create!(name: 'Deleted Book', owner: doug, scale: [ 0, 1 ]).id

    User.find(deleted_user_id).destroy!
    Book.find(deleted_book_id).really_destroy

    assert_nothing_raised do
      TrackBookViewedJob.perform_now(deleted_user_id, deleted_book_id)
    end
  end
end
