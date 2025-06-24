# frozen_string_literal: true

require 'csv'

module Api
  module V1
    # @tags books
    class BooksController < Api::ApiController
      before_action :set_book, only: [ :show, :update, :destroy ]
      before_action :check_book, only: [ :show, :update, :destroy ]

      def index
        @books = current_user.books_involved_with
        respond_with @books
      end

      def show
        respond_with @book
      end

      # @request_body [Reference:#/components/schemas/Book]
      # @request_body_example basic book [Reference:#/components/examples/BasicBook]
      def create
        @book = Book.new(book_params)
        if params[:book][:team_id]
          team = Team.find_by(id: params[:book][:team_id])
          @book.teams << team
        end
        if @book.save
          respond_with @book
        else
          render json: @book.errors, status: :bad_request
        end
      end

      # @request_body [Reference:#/components/schemas/Book]
      # @request_body_example basic book [Reference:#/components/examples/BasicBook]
      def update
        update_params = book_params
        if @book.update update_params
          # Analytics::Tracker.track_case_updated_event current_user, @case
          respond_with @book
        else
          render json: @book.errors, status: :bad_request
        end
      end

      # Delete a book and its child data including Query/Doc Pairs and Judgements.
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
