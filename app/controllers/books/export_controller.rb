# frozen_string_literal: true

require 'open-uri'
require 'json'

module Books
  class ExportController < ApplicationController
    before_action :set_book
    before_action :check_book

    def update
      # WARNING books/export_controller.rb and
      # api/v1/export/books_controller.rb ARE DUPLICATED
      message = nil

      if @book.export_job
        message = "Currently exporting book as file.  Status is #{@book.export_job}."
      else
        @book.export_file.purge
        track_book_export_queued do
          ExportBookJob.perform_later(@book)
        end
        message = 'Queued up export of book as file.'
      end

      redirect_to @book, notice: message
    end

    private

    def track_book_export_queued
      @book.update(export_job: "queued at #{Time.zone.now}")

      # Yield to the block to perform the job
      yield if block_given?
    end
  end
end
