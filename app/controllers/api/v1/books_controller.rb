# frozen_string_literal: true

require 'csv'

module Api
  module V1
    # @tags books
    class BooksController < Api::ApiController
      include BookScorerAssignment

      before_action :set_book, only: [ :show, :update, :destroy ]

      # @parameter archived(query) [Boolean] Whether or not to return only archived books in the response.
      # @parameter owned(query) [Boolean] Whether to return only books owned by the current user, excluding ones only shared via a team.
      def index
        archived = deserialize_bool_param(params[:archived])
        books = deserialize_bool_param(params[:owned]) ? current_user.books : current_user.books_involved_with
        @books = if archived
                   books.archived
                 else
                   books.active
                 end

        respond_with @books
      end

      def show
        respond_with @book
      end

      # @request_body [Reference:#/components/schemas/Book]
      # @request_body_example basic book [Reference:#/components/examples/BasicBook]
      def create
        @book = Book.new(book_params.except(:scorer_id))
        apply_scorer_to_book(@book, book_params[:scorer_id]) if book_params[:scorer_id].present?
        team_id = params.dig(:book, :team_id)
        team = current_user.teams.find(team_id) if team_id
        @book.owner ||= current_user
        if @book.save
          TeamSharing.new(current_user, team).share(@book) if team
          respond_with @book
        else
          render json: @book.errors, status: :bad_request
        end
      end

      # @request_body [Reference:#/components/schemas/Book]
      # @request_body_example basic book [Reference:#/components/examples/BasicBook]
      def update
        update_params = book_params.except(:scorer_id)
        apply_scorer_to_book(@book, book_params[:scorer_id]) if book_params[:scorer_id].present?
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
        params.expect(book: [ :scorer_id, :name, :support_implicit_judgements,
                              :show_rank, :archived ])
      end

      def set_book
        @book = current_user.books_involved_with.find(params.expect(:id))
        TrackBookViewedJob.perform_later current_user.id, @book.id
      end
    end
  end
end
