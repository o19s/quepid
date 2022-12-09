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
    respond_with(@book)
  end

  def new
    @book = Book.new
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

  private

  def find_book
    @book = current_user.books_involved_with.where(id: params[:id]).first
  end

  def check_book
    render json: { message: 'Book not found!' }, status: :not_found unless @book
  end

  def book_params
    params.require(:book).permit(:team_id, :scorer_id, :selection_strategy_id, :name)
  end
end
