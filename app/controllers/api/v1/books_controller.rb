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

      # @summary List all books to which the user has access.
      # @tags books
      def index
        @books = current_user.books_involved_with
        respond_with @books
      end

      # @summary Get a book by id.
      # @tags books
      def show
        respond_with @book
      end

      # @summary Create a Book
      # @tags books
      # @request_body The book to be created. At least include an `name`. [!Book]
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

      # @summary A Book can be updated with this method
      # @tags books
      # @request_body Book to be created [Hash{book: { name: String, show_rank: Boolean, support_implicit_judgements: Boolean, owner_id: !Integer, scorer_id: !Integer, selection_strategy_id: !Integer}}]
      # @request_body_example basic book [Hash]
      #   {
      #     book: {
      #       name: "Oas",
      #       show_rank: false,
      #       support_implicit_judgements: false,
      #       owner_id: 1,
      #       scorer_id: 1,
      #       selection_strategy_id: 1
      #     }
      #   }
      def update
        update_params = book_params
        if @book.update update_params
          # Analytics::Tracker.track_case_updated_event current_user, @case
          respond_with @book
        else
          render json: @book.errors, status: :bad_request
        end
      end

      # @summary Delete a Book
      # @tags books
      # Delete a book and its associated data like Query/Doc Pairs and Judgements.
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
