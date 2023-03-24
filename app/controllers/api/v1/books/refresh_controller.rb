# frozen_string_literal: true

module Api
  module V1
    module Books
      class RefreshController < Api::ApiController
        before_action :find_book, only: [ :update ]
        before_action :check_book, only: [ :update ]
        before_action :set_case, only: [ :update ]
        before_action :check_case, only: [ :update ]

        # rubocop:disable Metrics/MethodLength
        def update
          @counts = {}
          rating_count = 0
          query_count = 0

          @book.rated_query_doc_pairs.each do |query_doc_pair|
            query = Query.find_or_initialize_by(case: @case, query_text: query_doc_pair.query_text)
            query_count += 1 if query.new_record?
            rating = Rating.find_or_initialize_by(query: query, doc_id: query_doc_pair.doc_id)
            rating_count += 1 if rating.new_record?
            summed_rating = query_doc_pair.judgements.rateable.sum(&:rating)
            count_of_judgements = query_doc_pair.judgements.rateable.size
            rating.rating = (summed_rating / count_of_judgements).round # only have ints today in Quepid Ratings.

            rating.save
            query.save
          end
          @counts['queries_created'] = query_count
          @counts['ratings_created'] = rating_count
          respond_with @counts
        end
        # rubocop:enable Metrics/MethodLength

        private

        def find_book
          @book = current_user.books_involved_with.where(id: params[:book_id]).first
        end

        def check_book
          render json: { message: 'Book not found!' }, status: :not_found unless @book
        end
      end
    end
  end
end
