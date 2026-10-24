# frozen_string_literal: true

require 'action_view'

module Api
  module V1
    module Books
      class PopulateController < Api::ApiController
        include ActionView::Helpers::NumberHelper

        before_action :set_book_no_track, only: [ :update ]
        before_action :set_case

        # We get a messy set of params in this method, so we don't use the normal
        # approach of strong parameter validation.  We hardcode the only params
        # we care about.
        #
        # With 5000 queries in large case, this takes 108 seconds...
        #
        def update
          # A sync for this book is already queued or running (PopulateBookJob
          # itself also guards against duplicates via limits_concurrency, but
          # checking here avoids uploading a throwaway blob for a job that
          # would just get discarded). Respond with a conflict, rather than
          # silently succeeding, so the client's syncedPairsCache retries
          # these pairs on its next sync instead of assuming they landed.
          if @book.populate_job.present?
            head :conflict
            return
          end

          blob = DeferredPayload.stash!(query_doc_pairs_params, filename: "book_populate_#{@book.id}.bin.zip")

          # Pass the blob directly to the job instead of creating an attachment
          Analytics::Tracker.track_query_doc_pairs_bulk_updated_event current_user, @book, @book.query_doc_pairs.empty?
          @book.queue_job(:populate) do
            PopulateBookJob.perform_later @book, @case, blob
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
      end
    end
  end
end
