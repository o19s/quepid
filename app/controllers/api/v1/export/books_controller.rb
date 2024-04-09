# frozen_string_literal: true

module Api
  module V1
    module Export
      class BooksController < Api::ApiController
        api!
        before_action :set_book
        before_action :check_book

        # rubocop:disable Metrics/MethodLength
        # rubocop:disable Metrics/AbcSize
        # rubocop:disable Metrics/CyclomaticComplexity
        # rubocop:disable Metrics/PerceivedComplexity
        # rubocop:disable Layout/LineLength
        def show
          # WARNING books/export_controller.rb and
          # api/v1/export/books_controller.rb ARE DUPLICATED
          message = nil

          # Use ActiveJob native (right now only in tests)
          if ExportBookJob.queue_adapter.respond_to?(:enqueued_jobs)
            this_job_args = [ { _aj_globalid: @book.to_global_id.to_s } ]
            job_queued_with_args = ExportBookJob.queue_adapter.enqueued_jobs.any? do |job|
              ExportBookJob == job[:job] && job[:args].map(&:deep_symbolize_keys) == this_job_args
            end
          else # otherwise fall back to Sidekiq direct
            found_jobs = []
            queues = Sidekiq::Queue.all
            this_job_args = [ { _aj_globalid: @book.to_global_id.to_s } ]
            queues.each do |queue|
              queue.each do |job|
                job.args.each do |arg|
                  if arg['job_class'].to_s == ExportBookJob.to_s && arg['arguments'].map(&:deep_symbolize_keys) == this_job_args
                    found_jobs << job
                  end
                end
              end
            end
            job_queued_with_args = !found_jobs.empty?
          end

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
        # rubocop:enable Metrics/AbcSize
        # rubocop:enable Metrics/CyclomaticComplexity
        # rubocop:enable Metrics/PerceivedComplexity
        # rubocop:enable Layout/LineLength
      end
    end
  end
end
