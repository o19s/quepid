# frozen_string_literal: true

require 'open-uri'
require 'json'
module Books
  class ImportController < ApplicationController
    def new
      @book = Book.new
    end

    # rubocop:disable Metrics/MethodLength
    # rubocop:disable Security/Open
    def create
      @book = Book.new
      @book.owner = current_user

      uploaded_file = params[:book][:json_upload]
      json_file = uploaded_file.tempfile
      json_data = URI.open(json_file) do |file|
        JSON.parse(file.read)
      end

      begin
        params_to_use = JSON.parse(json_data.read).deep_symbolize_keys

        @book.name = params_to_use[:name]
        @book.json_upload.attach(uploaded_file)

        service = ::BookImporter.new @book, params_to_use, {}
        service.validate
      rescue JSON::ParserError => e
        @book.errors.add(:base, "Invalid JSON file format: #{e.message}")
      end

      if @book.errors.empty? && @book.save
        ImportBookJob.perform_later @book
        redirect_to @book, notice: 'Book was successfully created.'
      else
        render :new
      end
    end
    # rubocop:enable Metrics/MethodLength
    # rubocop:enable Security/Open
  end
end
