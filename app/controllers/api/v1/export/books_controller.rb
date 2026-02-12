# frozen_string_literal: true

module Api
  module V1
    module Export
      class BooksController < Api::ApiController
        before_action :set_book
        before_action :check_book

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
        # > Note: This is a async process, so first you get a `message`, then you get the `download_file_url`.
        def update
          # WARNING books/export_controller.rb and
          # api/v1/export/books_controller.rb ARE DUPLICATED
          message = nil

          if @book.export_job
            message = "Currently exporting book as file.  Status is #{@book.export_job}."
          else
            track_book_export_queued do
              ExportBookJob.perform_later(@book)
            end
            message = 'Starting export of book as file.'
          end

          if @book.export_file.attached?
            blob = @book.export_file.blob
            url = Rails.application.routes.url_helpers.rails_blob_url(blob, only_path: true)
            render json: { download_file_url: url }
          else
            render json: { message: message }, status: :ok
          end
        end

        private

        def track_book_export_queued
          @book.update(export_job: "queued at #{Time.zone.now}")

          # Yield to the block to perform the job
          yield if block_given?
        end
      end
    end
  end
end
