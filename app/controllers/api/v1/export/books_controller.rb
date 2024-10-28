# frozen_string_literal: true

module Api
  module V1
    module Export
      class BooksController < Api::ApiController
        api!
        before_action :set_book
        before_action :check_book

        # rubocop:disable Metrics/MethodLength
        def show
          # WARNING books/export_controller.rb and
          # api/v1/export/books_controller.rb ARE DUPLICATED
          message = nil

          # Use ActiveJob native (right now only in tests)
          this_job_args = [ { _aj_globalid: @book.to_global_id.to_s } ]

          job_queued_with_args = SolidQueue::Job.where(class_name: 'ExportBookJob', finished_at: nil).any? do |job|
            job_args = job.arguments.to_h
            SolidQueue::Job == this_job_args.all? { |hash| job_args.include?(hash) }
          end

          puts "job_queued_with_args: #{job_queued_with_args}"

          if job_queued_with_args
            message = 'Currently exporting book as file.'
          else
            ExportBookJob.perform_later @book
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
      end
    end
  end
end
