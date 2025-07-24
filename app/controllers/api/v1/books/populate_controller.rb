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
          track_book_populate_queued do
            PopulateBookJob.perform_later @book, @case
          end

          head :no_content
        end

        private

        def query_doc_pairs_params
          # avoid StrongParameters ;-( to faciliate sending params as
          # hash to ActiveJob via ActiveStorage by directly getting parameters from request
          # object
          request.parameters
        end

        def track_book_populate_queued
          @book.update(populate_job: "queued at #{Time.zone.now}")
          Analytics::Tracker.track_query_doc_pairs_bulk_updated_event current_user, @book, @book.query_doc_pairs.empty?

          # Yield to the block to perform the job
          yield if block_given?
        end
      end
    end
  end
end
