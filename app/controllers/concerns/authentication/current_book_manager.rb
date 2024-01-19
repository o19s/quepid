# frozen_string_literal: true

module Authentication
  module CurrentBookManager
    extend ActiveSupport::Concern

    private

    def find_book
      @book = current_user.books_involved_with.where(id: params[:book_id]).first
      TrackBookViewedJob.perform_later @book, current_user
    end

    def check_book
      render json: { message: 'Book not found!' }, status: :not_found unless @book
    end
  end
end
