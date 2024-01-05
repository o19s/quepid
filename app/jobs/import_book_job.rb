# frozen_string_literal: true

class ImportBookJob < ApplicationJob
  queue_as :default

  def perform book
    options = {}

    # Read and parse the JSON data
    json_data = JSON.parse(book.json_upload.download)

    service = ::BookImporter.new book, json_data.deep_symbolize_keys, options

    service.import
    book.json_upload.purge
    book.save
  end
end
