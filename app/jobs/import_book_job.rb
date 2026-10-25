# frozen_string_literal: true

class ImportBookJob < ApplicationJob
  queue_as :bulk_processing

  def perform user, book
    book.update(import_job: "import started at #{Time.zone.now}")
    options = {}

    DeferredPayload.consume(book.import_file) do |params|
      service = ::BookImporter.new book, user, params, options
      raise ActiveRecord::RecordInvalid, book unless service.import

      book.update!(import_job: nil)
    end
  end
end
