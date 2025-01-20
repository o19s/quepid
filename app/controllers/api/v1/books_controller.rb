# frozen_string_literal: true

require 'csv'

module Api
  module V1
    # rubocop:disable Metrics/ClassLength
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

      # rubocop:disable Metrics/MethodLength
      # rubocop:disable Metrics/AbcSize
      # rubocop:disable Metrics/CyclomaticComplexity
      # rubocop:disable Metrics/PerceivedComplexity
      # rubocop:disable Metrics/BlockLength
      api :GET, '/api/books/:book_id',
          'Show the book with the given ID.'
      param :id, :number,
            desc: 'The ID of the requested book.', required: true
      def show
        respond_to do |format|
          format.json
          format.csv do
            @csv_array = []
            csv_headers = %w[query docid]

            # Only return rateable judgements, filter out the unrateable ones.
            # unique_raters = @book.judgements.rateable.preload(:user).collect(&:user).uniq
            # unique_raters = @book.judges.merge(Judgement.rateable)
            unique_judge_ids = @book.query_doc_pairs.joins(:judgements)
              .distinct.pluck(:user_id)

            # this logic about using email versus name is kind of awful.  Think about user.full_name or user.identifier?
            unique_judges = []
            unique_judge_ids.each do |judge_id|
              judge = User.find(judge_id) unless judge_id.nil?
              unique_judges << judge
              csv_headers << make_csv_safe(if judge.nil?
                                             'anonymous'
                                           else
                                             judge.name.presence || judge.email
                                           end)
            end

            @csv_array << csv_headers
            query_doc_pairs = @book.query_doc_pairs.includes(:judgements)
            query_doc_pairs.each do |qdp|
              row = [ make_csv_safe(qdp.query_text), qdp.doc_id ]
              unique_judges.each do |judge|
                judgement = qdp.judgements.detect { |j| j.user == judge }
                rating = judgement.nil? ? '' : judgement.rating

                row.append rating
              end
              @csv_array << row
            end

            headers['Content-Disposition'] = "attachment; filename=\"book_#{@book.id}_export.csv\""
            headers['Content-Type'] ||= 'text/csv'
          end
        end
      end
      # rubocop:enable Metrics/MethodLength
      # rubocop:enable Metrics/AbcSize
      # rubocop:enable Metrics/CyclomaticComplexity
      # rubocop:enable Metrics/PerceivedComplexity
      # rubocop:enable Metrics/BlockLength

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
        @book.destroy
        # Analytics::Tracker.track_case_deleted_event current_user, @case

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

      def make_csv_safe str
        if %w[- = + @].include?(str[0])
          " #{str}"
        else
          str
        end
      end
    end
    # rubocop:enable Metrics/ClassLength
  end
end
