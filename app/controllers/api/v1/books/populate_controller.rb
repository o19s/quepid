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
        def update
          serialized_data = Marshal.dump(query_doc_pairs_params)

          compressed_data = Zlib::Deflate.deflate(serialized_data)
          @book.populate_file.attach(io: StringIO.new(compressed_data), filename: "book_populate_#{@book.id}.bin.zip",
                                     content_type: 'application/zip')
          PopulateBookJob.perform_later current_user, @book, @case
          head :no_content
        end

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
