# frozen_string_literal: true

module Api
  module V1
    module Export
      class BooksController < Api::ApiController
        api!
        before_action :set_book
        before_action :check_book

        # rubocop:disable Metrics/MethodLength
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
        # rubocop:enable Metrics/MethodLength

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
