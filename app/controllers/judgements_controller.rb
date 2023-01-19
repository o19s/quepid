# frozen_string_literal: true

class JudgementsController < ApplicationController
  before_action :set_judgement, only: [ :show, :edit, :update, :destroy ]
  before_action :find_book

  respond_to :html

  def index
    @judgements = @book.judgements
    respond_with(@judgements)
  end

  def show
    respond_with(@judgement)
  end

  def new
    @query_doc_pair = @book.random_query_doc_pair_for_rating
    @judgement = Judgement.new
    respond_with(@judgement)
  end

  def edit
  end

  def create
    @judgement = Judgement.new(judgement_params)

    @judgement.save

    session["last_judgement_id"] = @judgement["id"]

    redirect_to book_judge_path(@book)
  end

  def update
    @judgement.update(judgement_params)
    respond_with(@judgement, :location => book_query_doc_pair_judgements_path)
  end

  def destroy
    @judgement.destroy
    respond_with(@judgement, :location => book_judgements_path)
  end

  private

  def set_judgement
    @judgement = Judgement.find(params[:id])
  end

  def judgement_params
    params.require(:judgement).permit(:user_id, :rating, :query_doc_pair_id)
  end

  def find_book
    @book = current_user.books_involved_with.where(id: params[:book_id]).first
  end

  def check_book
    render json: { message: 'Book not found!' }, status: :not_found unless @book
  end
end
