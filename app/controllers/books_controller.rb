# frozen_string_literal: true

class BooksController < ApplicationController
  before_action :find_book, only: [ :show, :edit, :update, :destroy ]
  before_action :check_book, only: [ :show, :edit, :update, :destroy ]

  respond_to :html

  def index
    @books = current_user.books_involved_with
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

  def combine
    book_ids = params[:book_ids].select { |_key, value| '1' == value }.keys.map(&:to_i)
    puts "I got params: #{book_ids}"
    book_ids.each do |book_id|
      book_to_merge = current_user.books_involved_with.where(id: book_id).first
      puts "#{book_to_merge.name}: #{book_to_merge.query_doc_pairs.count} qdps, #{book_to_merge.judgements.count} j"
    end
  end

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
