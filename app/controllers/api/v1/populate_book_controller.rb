# frozen_string_literal: true

module Api
  module V1
    class PopulateBookController < Api::ApiController
      before_action :find_case
      before_action :check_case
      before_action :find_book
      before_action :check_book

      # We get a messy set of params in this method, so we don't use the normal
      # approach of strong parameter validation.  We hardcode the only params
      # we care about.
      def update
        # down the road we should be using ActiveRecord-import and first_or_initialize instead.
        # See how snapshots are managed.

        empty_book = @book.query_doc_pairs.empty?

        params[:query_doc_pairs].each do |pair|
          query_doc_pair = @book.query_doc_pairs.find_or_create_by query_text: pair[:query_text], doc_id: pair[:doc_id]
          query_doc_pair.rank = pair[:rank]
          query_doc_pair.document_fields = pair[:document_fields].to_json
          query_doc_pair.save
        end

        Analytics::Tracker.track_query_doc_pairs_bulk_updated_event current_user, @book, empty_book
        head :no_content
      end

      private

      # def rating_params
      #  params.permit(:rating)
      # should be params.require(:rating).permit(:rating) to
      # follow standard pattern.
      # end

      def pluck_out_just_rating_param
        params[:rating]
      end

      def find_book
        @book = @case.book
      end
      def check_book
        render json: { message: 'Book not found!' }, status: :not_found unless @book
      end
    end
  end
end
