# frozen_string_literal: true

module Api
  module V1
    module Export
      class BooksController < Api::ApiController
        include ActionView::Helpers::NumberHelper
        api!
        before_action :set_book
        before_action :check_book

        # rubocop:disable Layout/LineLength
        # rubocop:disable Metrics/MethodLength
        def show
          message = nil

          this_job_args = [ { _aj_globalid: @book.to_global_id.to_s } ]
          job_queued_with_args = ExportBookJob.queue_adapter.enqueued_jobs.any? { |job| ExportBookJob == job[:job] && job[:args].map(&:deep_symbolize_keys) == this_job_args }

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
        # rubocop:enable Layout/LineLength
        # rubocop:enable Metrics/MethodLength
      end
    end
  end
end
