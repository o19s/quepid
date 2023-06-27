# frozen_string_literal: true

class BooksController < ApplicationController
  before_action :find_book, only: [ :show, :edit, :update, :destroy, :combine ]
  before_action :check_book, only: [ :show, :edit, :update, :destroy, :combine ]

  respond_to :html

  def index
    @books = current_user.books_involved_with.includes([ :team, :scorer, :selection_strategy ])
    respond_with(@books)
  end

  def show
    @cases = Case.where(book_id: @book.id)
    respond_with(@book)
  end

  def new
    # we actually support passing in starting point configuration for a book
    @book = if params[:book]
              Book.new(book_params)
            else
              Book.new
            end
    respond_with(@book)
  end

  def edit
  end

  def create
    @book = Book.new(book_params)
    @book.save
    respond_with(@book)
  end

  def update
    @book.update(book_params)
    respond_with(@book)
  end

  def destroy
    @book.destroy
    respond_with(@book)
  end

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/MethodLength
  def combine
    book_ids = params[:book_ids].select { |_key, value| '1' == value }.keys.map(&:to_i)
    puts "I got params: #{book_ids}"

    query_doc_pair_count = 0

    book_ids.each do |book_id|
      book_to_merge = current_user.books_involved_with.where(id: book_id).first
      puts "#{book_to_merge.name}: #{book_to_merge.query_doc_pairs.count} qdps, #{book_to_merge.judgements.count} j"
      book_to_merge.query_doc_pairs.each do |qdp|
        query_doc_pair = @book.query_doc_pairs.find_or_create_by query_text: qdp.query_text,
                                                                 doc_id:     qdp.doc_id

        qdp.judgements.rateable.includes([ :user ]).each do |j|
          query_doc_pair.judgements << Judgement.new(rating: j.rating, user: j.user)
        end
        query_doc_pair_count += 1 # if query_doc_pair.new_record?

        query_doc_pair.save
      end
    end

    redirect_to books_path, :notice => "ok.  Combined #{query_doc_pair_count} query/doc pairs."
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/MethodLength

  private

  def find_book
    @book = current_user.books_involved_with.where(id: params[:id]).first
  end

  def check_book
    render json: { message: 'Book not found!' }, status: :not_found unless @book
  end

  def book_params
    params.require(:book).permit(:team_id, :scorer_id, :selection_strategy_id, :name, :support_implicit_judgements)
  end
end
