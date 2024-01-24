# frozen_string_literal: true

require 'action_view'

module Api
  module V1
    module Books
      class PopulateController < Api::ApiController
        include ActionView::Helpers::NumberHelper
        before_action :set_book, only: [ :update ]
        before_action :check_book, only: [ :update ]
        before_action :set_case
        before_action :check_case

        # We get a messy set of params in this method, so we don't use the normal
        # approach of strong parameter validation.  We hardcode the only params
        # we care about.
        # 
        # With 5000 queries in large case, this takes 108 seconds...
        # 
        # rubocop:disable Layout/LineLength
        def update
          puts "[PopulateController] Request Size is #{number_to_human_size(query_doc_pairs_params.to_s.bytesize)}"

          serialized_data = Marshal.dump(query_doc_pairs_params)

          puts "[PopulateController] the size of the serialized data is #{number_to_human_size(serialized_data.bytesize)}"
          compressed_data = Zlib::Deflate.deflate(serialized_data)
          puts "[PopulateController] the size of the compressed data is #{number_to_human_size(compressed_data.bytesize)}"
          @book.populate_file.attach(io: StringIO.new(compressed_data), filename: "book_populate_#{@book.id}.bin.zip",
                                     content_type: 'application/zip')
          PopulateBookJob.perform_later current_user, @book, @case
          head :no_content
        end
        # rubocop:enable Layout/LineLength

        private

        def query_doc_pairs_params
          # avoid StrongParameters ;-( to faciliate sending params as
          # hash to ActiveJob via ActiveStorage by directly getting parameters from request
          # object
          request.parameters
        end
      end
    end
  end
end
