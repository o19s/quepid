# frozen_string_literal: true

class ImportBookJob < ApplicationJob
  queue_as :default

  # rubocop:disable Security/MarshalLoad
  def perform user, book
    options = {}

    compressed_data = book.import_file.download
    serialized_data = Zlib::Inflate.inflate(compressed_data)
    params  = Marshal.load(serialized_data)

    service = ::BookImporter.new book, user, params, options

    service.import
    book.import_file.purge
    book.save
  end
  # rubocop:enable Security/MarshalLoad
end
