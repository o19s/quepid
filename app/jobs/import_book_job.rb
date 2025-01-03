# frozen_string_literal: true

class ImportBookJob < ApplicationJob
  queue_as :bulk_processing

  # rubocop:disable Security/MarshalLoad
  def perform user, book
    book.update(import_job: "import started at #{Time.zone.now}")
    options = {}

    compressed_data = book.import_file.download
    serialized_data = Zlib::Inflate.inflate(compressed_data)
    params  = Marshal.load(serialized_data)

    service = ::BookImporter.new book, user, params, options

    service.import
    book.import_file.purge
    book.import_job = nil
    book.save
  end
  # rubocop:enable Security/MarshalLoad
end
