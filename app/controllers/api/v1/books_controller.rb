# frozen_string_literal: true

require 'csv'

module Api
  module V1
    class BooksController < Api::ApiController
      before_action :set_book, only: [ :show, :update, :destroy ]
      before_action :check_book, only: [ :show, :update, :destroy ]

      def_param_group :book_params do
        param :book, Hash, required: true do
          param :name, String
          param :show_rank, [ true, false ]
          param :support_implicit_judgements, [ true, false ]
          param :owner_id, Integer
          param :scorer_id, Integer
          param :selection_strategy_id, Integer
        end
      end

      api :GET, '/api/books',
          'List all books to which the user has access.'
      def index
        @books = current_user.books_involved_with
        respond_with @books
      end

      api :GET, '/api/books/:book_id',
          'Show the book with the given ID.'
      param :id, :number,
            desc: 'The ID of the requested book.', required: true
      def show
        respond_with @book
      end

      api :POST, '/api/books', 'Create a new book.'
      param_group :book_params
      def create
        @book = Book.new(book_params)
        team = Team.find_by(id: params[:book][:team_id])
        @book.teams << team
        if @book.save
          respond_with @book
        else
          render json: @book.errors, status: :bad_request
        end
      end

      api :PUT, '/api/books/:book_id', 'Update a given book.'
      param :id, :number,
            desc: 'The ID of the requested book.', required: true
      param_group :book_params
      def update
        update_params = book_params
        if @book.update update_params
          # Analytics::Tracker.track_case_updated_event current_user, @case
          respond_with @book
        else
          render json: @book.errors, status: :bad_request
        end
        # rescue ActiveRecord::InvalidForeignKey
        # render json: { error: 'Invalid id' }, status: :bad_request
      end

      api :DELETE, '/api/books/:book_id', 'Delete a given book.'
      param :id, :number,
            desc: 'The ID of the requested book.', required: true
      def destroy
        @book.really_destroy

        head :no_content
      end

      private

      def book_params
        params.expect(book: [ :scorer_id, :selection_strategy_id, :name, :support_implicit_judgements,
                              :show_rank ])
      end

      def set_book
        @book = current_user.books_involved_with.where(id: params[:id]).first
        TrackBookViewedJob.perform_later current_user, @book
      end

      def check_book
        render json: { message: 'Book not found!' }, status: :not_found unless @book
      end
    end
  end
end
