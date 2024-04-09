# frozen_string_literal: true

require 'zip'
require 'action_controller'

class ExportBookJob < ApplicationJob
  queue_as :default

  def perform book
    # renderer = ::ApplicationController.renderer.new

    json_data = Api::V1::Export::BooksController.renderer.render template: 'api/v1/export/books/show',
                                                                 assigns:  { book: book }

    compressed_data = create_zip_from_json(json_data, "book_export_#{book.id}.json")

    book.export_file.attach(io: compressed_data, filename: "book_export_#{book.id}.json.zip",
                            content_type: 'application/zip')
  end

  def create_zip_from_json json_string, filename
    zip_data = Zip::OutputStream.write_buffer do |zipfile|
      zipfile.put_next_entry(filename)
      zipfile.write(json_string)
    end
    zip_data.rewind
    zip_data
  end
end
