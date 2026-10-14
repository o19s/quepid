# frozen_string_literal: true

require 'zip'
require 'action_controller'

class ExportBookJob < ApplicationJob
  include ActionView::RecordIdentifier

  queue_as :bulk_processing

  def perform book
    book.update(export_job: "export started at #{Time.zone.now}")
    broadcast_export_status(book)
    broadcast_progress(book, "Starting to export book #{book.name}", 33)

    json_data = Api::V1::Export::BooksController.renderer.render template: 'api/v1/export/books/show',
                                                                 assigns:  { book: book }

    compressed_data = create_zip_from_json(json_data, "book_export_#{book.id}.json")

    broadcast_progress(book, "JSON exported for  #{book.name}, starting to create file", 66)

    book.export_file.attach(io: compressed_data, filename: "book_export_#{book.id}.json.zip",
                            content_type: 'application/zip')
    book.update(export_job: nil)
    broadcast_export_status(book)

    broadcast_progress(book, "Completed exporting book #{book.name}.", 100, export_link: true)
  rescue StandardError
    # Without this the book stays "currently being exported" forever and the
    # Export button never comes back.
    book.update(export_job: nil)
    broadcast_export_status(book, failed: true)
    broadcast_progress(book, "Exporting book #{book.name} failed.", 100)
    raise
  end

  def broadcast_progress book, message, progress, export_link: false
    ProgressBroadcaster.render(book, partial: 'books/notification',
                                     locals:  { book: book, message: message, progress: progress, export_link: export_link })
  end

  def broadcast_export_status book, failed: false
    Turbo::StreamsChannel.broadcast_replace_to(book, :export, target:  dom_id(book, :export_status),
                                                              partial: 'books/export_status',
                                                              locals:  { book: book, failed: failed })
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
