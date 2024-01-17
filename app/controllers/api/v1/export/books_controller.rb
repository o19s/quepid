# frozen_string_literal: true

require 'zip'
require 'action_view'

module Api
  module V1
    module Export
      class BooksController < Api::ApiController
        include ActionView::Helpers::NumberHelper
        api!
        before_action :find_book
        before_action :check_book

        # rubocop:disable Layout/LineLength
        def show
          # do we want to make the file downloadable
          download = 'true' == params[:download]

          respond_to do |format|
            format.json do
              if download
                json_data = render_to_string(template: 'api/v1/export/books/show')

                puts "the size of the json data is #{number_to_human_size(json_data.bytesize)}"

                compressed_data = create_zip_from_json(json_data, "book_export_#{@book.id}.json")

                @book.export_file.attach(io: compressed_data, filename: "book_export_#{@book.id}.json.zip",
                                         content_type: 'application/zip')

                blob = @book.export_file.blob

                url = Rails.application.routes.url_helpers.rails_blob_url(blob, only_path: true)
                render json: { download_file_url: url }
              end
            end
          end
        end

        private

        def find_book
          @book = current_user.books_involved_with.where(id: params[:book_id]).includes(:query_doc_pairs).preload([ query_doc_pairs: [ :judgements ] ]).first
        end
        # rubocop:enable Layout/LineLength

        def check_book
          render json: { message: 'Book not found!' }, status: :not_found unless @book
        end

        def create_zip_from_json json_string, filename
          zip_data = Zip::OutputStream.write_buffer do |zipfile|
            zipfile.put_next_entry(filename)
            zipfile.write(json_string)
          end
          zip_data.rewind
          zip_data
        end
      end
    end
  end
end
