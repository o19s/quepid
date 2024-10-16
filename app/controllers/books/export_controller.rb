# frozen_string_literal: true

require 'open-uri'
require 'json'

module Books
  class ExportController < ApplicationController
    before_action :set_book
    before_action :check_book

    # rubocop:disable Metrics/MethodLength
    # rubocop:disable Metrics/AbcSize
    # rubocop:disable Layout/LineLength
    # rubocop:disable Metrics/CyclomaticComplexity
    # rubocop:disable Metrics/PerceivedComplexity
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
        @book.export_file.purge
        ExportBookJob.perform_later @book
        message = 'Queued up export of book as file.'
      end

      redirect_to @book, notice: message
    end
    # rubocop:enable Metrics/MethodLength
    # rubocop:enable Metrics/AbcSize
    # rubocop:enable Layout/LineLength
    # rubocop:enable Metrics/CyclomaticComplexity
    # rubocop:enable Metrics/PerceivedComplexity
  end
end
