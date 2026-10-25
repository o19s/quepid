# frozen_string_literal: true

require 'test_helper'

# books/export_controller.rb (HTML) and api/v1/export/books_controller.rb (JSON) are duplicated
# implementations.  This pins the behavior they must share, so a change to one fails until the
# other is updated too.
class BookExportContractTest < ActionDispatch::IntegrationTest
  let(:doug) { users(:doug) }
  let(:book) { books(:james_bond_movies) }

  setup do
    Bullet.enable = false
    login_user_for_integration_test doug
  end

  # Each entry issues the export request and returns the user-facing status message.
  ENTRYPOINTS = {
    html: lambda { |test|
      test.put test.books_export_url(book_id: test.book.id)
      test.flash[:notice]
    },
    api:  lambda { |test|
      test.put test.api_export_book_url(book_id: test.book.id, format: :json)
      test.response.parsed_body['message']
    },
  }.freeze

  ENTRYPOINTS.each do |name, request|
    test "#{name}: first request enqueues one job and marks the book queued" do
      request.call(self)

      assert_enqueued_jobs 1, only: ExportBookJob
      assert_enqueued_with(job: ExportBookJob, args: [ book ])
      assert book.reload.export_job.start_with?('queued at')
    end

    test "#{name}: duplicate request reports progress and does not enqueue again" do
      request.call(self)
      message = request.call(self)

      assert_match(/\ACurrently exporting book as file\.  Status is queued at/, message)
      assert_enqueued_jobs 1, only: ExportBookJob
    end
  end
end
