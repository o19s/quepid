# frozen_string_literal: true

require 'test_helper'

module Books
  class ExportControllerTest < ActionDispatch::IntegrationTest
    let(:doug) { users(:doug) }
    let(:book) { books(:james_bond_movies) }

    setup do
      Bullet.enable = false
    end

    test 'requires login' do
      put books_export_url(book_id: book.id)

      assert_response :redirect
      assert_no_enqueued_jobs only: ExportBookJob
    end

    test 'queues an export and redirects to the book with a notice' do
      login_user_for_integration_test doug

      put books_export_url(book_id: book.id)

      assert_redirected_to book_url(book)
      assert_equal 'Queued up export of book as file.', flash[:notice]
      assert_enqueued_with(job: ExportBookJob, args: [ book ])
      assert book.reload.export_job.start_with?('queued at')
    end

    test 'a duplicate request reports the in-progress status and does not enqueue again' do
      login_user_for_integration_test doug

      put books_export_url(book_id: book.id)
      assert_enqueued_jobs 1, only: ExportBookJob

      put books_export_url(book_id: book.id)

      assert_redirected_to book_url(book)
      assert_match(/\ACurrently exporting book as file\.  Status is queued at/, flash[:notice])
      assert_enqueued_jobs 1, only: ExportBookJob
    end

    test 'purges a previously exported file before queueing a new export' do
      login_user_for_integration_test doug
      book.export_file.attach(io: StringIO.new('old'), filename: 'old.zip', content_type: 'application/zip')
      assert_predicate book.export_file, :attached?

      put books_export_url(book_id: book.id)

      assert_not book.reload.export_file.attached?
      assert_enqueued_with(job: ExportBookJob, args: [ book ])
    end

    test 'can queue again once the job has completed' do
      login_user_for_integration_test doug
      book.update!(export_job: nil)

      put books_export_url(book_id: book.id)

      assert_equal 'Queued up export of book as file.', flash[:notice]
    end

    test 'returns not found for a book the user cannot access' do
      other_book = Book.create!(name: 'Private Book', owner: users(:random_1), scale: '0,1')
      login_user_for_integration_test doug

      put books_export_url(book_id: other_book.id)

      assert_response :not_found
      assert_no_enqueued_jobs only: ExportBookJob
    end

    test 'returns not found for a missing book' do
      login_user_for_integration_test doug

      put books_export_url(book_id: 0)

      assert_response :not_found
    end
  end
end
