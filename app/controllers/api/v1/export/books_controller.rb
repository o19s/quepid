# frozen_string_literal: true

module Api
  module V1
    module Export
      class BooksController < Api::ApiController
        before_action :set_book

        # @summary Export a complete book
        # @tags books > import/export
        #
        # @response While the book is being exported(202)
        #   [
        #     Hash{
        #       message: String
        #     }
        #   ]
        #
        # @response When the book is exported the url to the file (200)
        #   [
        #     Hash{
        #       download_file_url: String
        #     }
        #   ]
        #
        # @response_example Currently running (202) [{"message": "Currently exporting book as file.  Status is running" }]
        # @response_example Export completed (200) [{"download_file_url": "/rails/active_storage/blobs/proxy/eyJfcmFpbHMiOnsiZGF0YSI6MywicHVyIjoiYmxvYl9pZCJ9fQ/book_export_1.json.zip" }]
        #
        # > Note: PUT/PATCH starts an export. Poll the same URL with GET for status and the completed download_file_url.
        def show
          if @book.export_job
            render json: { message: "Currently exporting book as file.  Status is #{@book.export_job}." }, status: :ok
          elsif @book.export_file.attached?
            blob = @book.export_file.blob
            url = Rails.application.routes.url_helpers.rails_blob_url(blob, only_path: true)
            render json: { download_file_url: url }
          else
            render json: { message: 'No completed export. Send an update request to start one.' }, status: :ok
          end
        end

        # Update requests start a fresh export; GET requests poll its status.
        def update
          started = false
          @book.with_lock do
            unless @book.export_job
              started = true
              old_blob = @book.export_file.blob if @book.export_file.attached?
              @book.export_file.detach
              @book.queue_job(:export) { ExportBookJob.perform_later(@book) }
              ActiveRecord.after_all_transactions_commit { old_blob.purge_later } if old_blob
            end
          end
          if started
            render json: { message: 'Starting export of book as file.' }, status: :ok
          else
            show
          end
        end
      end
    end
  end
end
