# frozen_string_literal: true

require 'open-uri'
require 'json'

module Books
  class ExportController < ApplicationController
    before_action :set_book

    def update
      message = nil

      if @book.export_job
        message = "Currently exporting book as file.  Status is #{@book.export_job}."
      else
        @book.export_file.purge
        @book.queue_job(:export) do
          ExportBookJob.perform_later(@book)
        end
        message = 'Queued up export of book as file.'
      end

      redirect_to @book, notice: message, status: :see_other
    end
  end
end
