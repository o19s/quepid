# frozen_string_literal: true

require 'open-uri'
require 'json'

module Books
  class ExportController < ApplicationController
    before_action :set_book
    before_action :check_book

    def show
      # WARNING books/export_controller.rb and
      # api/v1/export/books_controller.rb ARE DUPLICATED
      message = nil

      this_job_args = [ { _aj_globalid: @book.to_global_id.to_s } ]

      job_queued_with_args = SolidQueue::Job.where(class_name: 'ExportBookJob', finished_at: nil).any? do |job|
        job_args = job.arguments.to_h
        SolidQueue::Job == this_job_args.all? { |hash| job_args.include?(hash) }
      end

      puts "job_queued_with_args: #{job_queued_with_args}"

      if job_queued_with_args
        message = 'Currently exporting book as file.'
      else
        @book.export_file.purge
        ExportBookJob.perform_later @book
        message = 'Queued up export of book as file.'
      end

      redirect_to @book, notice: message
    end
  end
end
