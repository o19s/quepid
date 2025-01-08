# frozen_string_literal: true

module Authentication
  module CurrentBookManager
    extend ActiveSupport::Concern

    included do
      helper_method :set_recent_books
    end

    private

    def set_book
      @book = current_user.books_involved_with.where(id: params[:book_id]).first
      TrackBookViewedJob.perform_later current_user, @book
    end

    def check_book
      render json: { message: 'Book not found!' }, status: :not_found unless @book
    end

    def set_recent_books
      @recent_books = recent_books(3)
    end

    def recent_books count
      if current_user
        book_ids = current_user.book_metadata.order(last_viewed_at: :desc).limit(count).pluck(:book_id)

        # map to objects
        books = current_user.books_involved_with.where(id: book_ids)

      else
        books = []
      end
      books
    end
  end
end
