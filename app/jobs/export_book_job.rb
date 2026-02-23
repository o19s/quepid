# frozen_string_literal: true

require 'zip'
require 'action_controller'

class ExportBookJob < ApplicationJob
  queue_as :bulk_processing

  def perform book
    book.update(export_job: "export started at #{Time.zone.now}")
    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  'notifications',
      partial: 'books/notification',
      locals:  { book: book, message: "Starting to export book #{book.name}", progress: 33 }
    )

    json_data = Api::V1::Export::BooksController.renderer.render template: 'api/v1/export/books/show',
                                                                 assigns:  { book: book }

    compressed_data = create_zip_from_json(json_data, "book_export_#{book.id}.json")

    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  'notifications',
      partial: 'books/notification',
      locals:  { book: book, message: "JSON exported for  #{book.name}, starting to create file", progress: 66 }
    )

    book.export_file.attach(io: compressed_data, filename: "book_export_#{book.id}.json.zip",
                            content_type: 'application/zip')
    book.update(export_job: nil)

    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  'notifications',
      partial: 'books/notification',
      locals:  { book:     book,
                 message:  "Completed exporting book #{book.name}.  Please refresh this page to get the link.",
                 progress: 100 }
    )
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
