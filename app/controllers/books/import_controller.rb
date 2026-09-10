# frozen_string_literal: true

require 'open-uri'
require 'json'
require 'zip'

module Books
  class ImportController < ApplicationController
    # Attributes only meaningful when importing a whole book (see BookImporter#import's
    # apply_top_level_attributes/apply_scale, which also reads scale/scale_with_labels
    # nested under a `scorer` key). Stripped for the "add more data to an existing book"
    # update flow so a re-exported file can't silently rename the book or change its
    # scale/rank settings as a side effect of importing more judgements.
    BOOK_LEVEL_ATTRIBUTES = [
      :name, :scale, :scale_with_labels, :show_rank, :support_implicit_judgements, :scorer
    ].freeze

    before_action :set_book,
                  only: [ :edit, :update ]
    before_action :check_book,
                  only: [ :edit, :update ]

    def new
      @book = Book.new
    end

    def edit
    end

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

      params_to_use = load_import_params(@book)
      @book.name = params_to_use[:name] if params_to_use

      if queue_import(@book, params_to_use)
        redirect_to @book, notice: 'Book was successfully created.'
      else
        render :new, status: :unprocessable_content
      end
    end

    # @summary Import additional data into an existing book
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
    def update
      params_to_use = load_import_params(@book)
      params_to_use = strip_book_level_attributes(params_to_use) if params_to_use

      if queue_import(@book, params_to_use)
        redirect_to @book, notice: 'Data was successfully queued for import.'
      else
        render :edit, status: :unprocessable_content
      end
    end

    private

    def load_import_params book
      uploaded_file = params[:book][:import_file]
      if uploaded_file.nil?
        book.errors.add(:base, 'You must select the file to be imported first.')
        return nil
      end

      read_uploaded_json(uploaded_file).deep_symbolize_keys
    rescue JSON::ParserError => e
      book.errors.add(:base, "Invalid JSON file format. Unable to parse the provided data structure. #{e.message}")
      nil
    rescue StandardError => e
      book.errors.add(:base, "Invalid JSON file: Unable to process the provided data structure. #{e.message}")
      nil
    end

    def read_uploaded_json uploaded_file
      tempfile = uploaded_file.tempfile
      is_zip = 'application/zip' == uploaded_file.content_type || uploaded_file.path.end_with?('.zip')
      return read_json(tempfile) unless is_zip

      Zip::File.open(tempfile.path) do |zip_file|
        json_file_entry = zip_file.entries.find { |e| e.name.end_with?('.json') }
        raise 'No JSON file found in the zip.' unless json_file_entry

        json_file_entry.get_input_stream { |io| read_json(io) }
      end
    end

    def strip_book_level_attributes params_to_use
      params_to_use.except(*BOOK_LEVEL_ATTRIBUTES)
    end

    # Validates and, if valid, stashes the upload for ImportBookJob and queues it.
    # Returns true on success; false so the caller can render the failure view when
    # validation added errors. Named like `save`/`update` (bool return, no `?`) since,
    # like them, it has side effects rather than being a pure predicate.
    # rubocop:disable Naming/PredicateMethod
    def queue_import book, params_to_use
      return false unless params_to_use && book.errors.empty?

      force_create_users = deserialize_bool_param(params[:book][:force_create_users])
      service = ::BookImporter.new book, current_user, params_to_use, { force_create_users: force_create_users }
      validate_import(book, service)

      return false unless book.errors.empty? && book.save

      serialized_data = Marshal.dump(params_to_use)
      compressed_data = Zlib::Deflate.deflate(serialized_data)
      book.import_file.attach(io: StringIO.new(compressed_data), filename: "book_import_#{book.id}.bin.zip",
                              content_type: 'application/zip')
      book.save

      track_book_import_queued(book) do
        ImportBookJob.perform_later current_user, book
      end

      true
    end
    # rubocop:enable Naming/PredicateMethod

    def validate_import book, service
      service.validate
    rescue StandardError => e
      book.errors.add(:base, "Invalid JSON file: Unable to process the provided data structure. #{e.message}")
    end

    def set_book
      @book = current_user.books_involved_with.where(id: params[:id]).first
      TrackBookViewedJob.perform_later current_user, @book
    end

    def read_json file
      JSON.parse(file.read)
    end

    def track_book_import_queued book
      book.update(import_job: "queued at #{Time.zone.now}")

      # Yield to the block to perform the job
      yield if block_given?
    end
  end
end
