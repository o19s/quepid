# frozen_string_literal: true

require 'open-uri'
require 'json'
require 'zip'

module Books
  class ImportController < ApplicationController
    before_action :set_book,
                  only: [ :edit ]

    def new
      @book = Book.new
    end

    def edit
    end

    # rubocop:disable Metrics/MethodLength
    # rubocop:disable Metrics/AbcSize
    # rubocop:disable Metrics/PerceivedComplexity
    # rubocop:disable Metrics/CyclomaticComplexity
    # @summary Import a complete book as File
    # @tags books > import/export
    # @request_body Upload a file(multipart/form-data)
    #   [
    #     !Hash{
    #       book: Hash{
    #         force_create_users: Boolean,
    #         import_file: File
    #       }
    #     }
    #   ]
    # > Note: This is not currently rendering in these API docs properly!
    def create
      @book = Book.new
      @book.owner = current_user

      force_create_users = deserialize_bool_param(params[:book][:force_create_users])

      uploaded_file = params[:book][:import_file]
      if uploaded_file.nil?
        @book.errors.add(:base, 'You must select the file to be imported first.')
      else
        tempfile = uploaded_file.tempfile
        json_data = if 'application/zip' == uploaded_file.content_type || uploaded_file.path.end_with?('.zip')
                      # Handle zip file
                      Zip::File.open(tempfile.path) do |zip_file|
                        # Assuming the zip contains only one JSON file
                        json_file_entry = zip_file.entries.find { |e| e.name.end_with?('.json') }
                        if json_file_entry
                          json_file_entry.get_input_stream { |io| read_json(io) }
                        else
                          raise 'No JSON file found in the zip.'
                        end
                      end
                    else
                      # Handle normal JSON file
                      begin
                        read_json(tempfile)
                      rescue JSON::ParserError => e
                        @book.errors.add(:base,
                                         "Invalid JSON file format. Unable to parse the provided data structure. #{e.message}")
                      end
                    end
      end
      if @book.errors.empty?
        begin
          params_to_use = json_data.deep_symbolize_keys

          @book.name = params_to_use[:name]

          service = ::BookImporter.new @book, current_user, params_to_use, { force_create_users: force_create_users }
          service.validate
        rescue StandardError => e
          @book.errors.add(:base, "Invalid JSON file: Unable to process the provided data structure. #{e.message}")
        end
      end
      if @book.errors.empty? && @book.save
        serialized_data = Marshal.dump(params_to_use)
        compressed_data = Zlib::Deflate.deflate(serialized_data)
        @book.import_file.attach(io: StringIO.new(compressed_data), filename: "book_import_#{@book.id}.bin.zip",
                                 content_type: 'application/zip')
        @book.save

        track_book_import_queued do
          ImportBookJob.perform_later current_user, @book
        end
        redirect_to @book, notice: 'Book was successfully created.'
      else
        render :new
      end
    end
    # rubocop:enable Metrics/MethodLength
    # rubocop:enable Metrics/AbcSize
    # rubocop:enable Metrics/PerceivedComplexity
    # rubocop:enable Metrics/CyclomaticComplexity
    # rubocop:enable Layout/LineLength

    private

    def set_book
      @book = current_user.books_involved_with.where(id: params[:id]).first
      TrackBookViewedJob.perform_later current_user, @book
    end

    def read_json file
      JSON.parse(file.read)
    end

    def track_book_import_queued
      @book.update(import_job: "queued at #{Time.zone.now}")

      # Yield to the block to perform the job
      yield if block_given?
    end
  end
end
