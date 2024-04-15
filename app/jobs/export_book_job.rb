# frozen_string_literal: true

require 'zip'
require 'action_controller'

class ExportBookJob < ApplicationJob
  queue_as :default

  # rubocop:disable Metrics/MethodLength
  def perform book
    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  'notifications',
      partial: 'books/notification',
      locals:  { book: book, message: "Starting to export book #{book.name}" }
    )

    json_data = Api::V1::Export::BooksController.renderer.render template: 'api/v1/export/books/show',
                                                                 assigns:  { book: book }

    compressed_data = create_zip_from_json(json_data, "book_export_#{book.id}.json")

    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  'notifications',
      partial: 'books/notification',
      locals:  { book: book, message: "JSON exported for  #{book.name}, starting to create file" }
    )

    book.export_file.attach(io: compressed_data, filename: "book_export_#{book.id}.json.zip",
                            content_type: 'application/zip')

    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  'notifications',
      partial: 'books/notification',
      locals:  { book:    book,
                 message: "Completed exporting book #{book.name}.  Please refresh the page to get the link." }
    )
  end
  # rubocop:enable Metrics/MethodLength

  def create_zip_from_json json_string, filename
    zip_data = Zip::OutputStream.write_buffer do |zipfile|
      zipfile.put_next_entry(filename)
      zipfile.write(json_string)
    end
    zip_data.rewind
    zip_data
  end
end
