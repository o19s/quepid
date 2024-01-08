# frozen_string_literal: true

require 'zlib'
module Api
  module V1
    module Export
      class BooksController < Api::ApiController
        api!
        before_action :find_book
        before_action :check_book

        # rubocop:disable Metrics/MethodLength
        # rubocop:disable Layout/LineLength
        def show
          # do we want to make the file downloadable
          download = 'true' == params[:download]

          respond_to do |format|
            format.json do
              if download
                # compressed_data = Zlib::Deflate.deflate(render_to_string(template: 'api/v1/export/books/show', locals: { book: @book }))
                json_data = render_to_string(template: 'api/v1/export/books/show', locals: { book: @book })

                puts 'about to attach'
                @book.json_export.attach(io: StringIO.new(json_data), filename: "book_export_#{@book.id}.json",
                                         content_type: 'application/json')

                puts 'done with attach'
                blob = @book.json_export.blob
                puts 'about to geenrate url'
                url = Rails.application.routes.url_helpers.rails_blob_url(blob, only_path: true)
                puts "about to render ok with url: #{url}"
                # render plain: "OK #{url}"

                # send_data file_data, filename: blob.filename.to_s, type: blob.content_type, disposition: 'attachment'
              end
            end
          end
        end
        # rubocop:enable Metrics/MethodLength

        private

        def find_book
          @book = current_user.books_involved_with.where(id: params[:book_id]).includes(:query_doc_pairs).preload([ query_doc_pairs: [ :judgements ] ]).first
        end
        # rubocop:enable Layout/LineLength

        def check_book
          render json: { message: 'Book not found!' }, status: :not_found unless @book
        end
      end
    end
  end
end
