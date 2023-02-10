# frozen_string_literal: true

class JudgementsController < ApplicationController
  before_action :set_judgement, only: [ :show, :edit, :update, :destroy ]
  before_action :find_book

  def index
    @judgements = @book.judgements
  end

  def show; end

  def new
    @query_doc_pair = @book.random_query_doc_pair_for_rating
    if @query_doc_pair then
      @query = @current_user.queries.where.not(information_need: [nil, ""]).where(query_text: @query_doc_pair.query_text).first
    end
    @judgement = Judgement.new
  end

  def edit; end

  def create
    @judgement = Judgement.new(judgement_params)

    if @judgement.save
      session['last_judgement_id'] = @judgement['id']
      redirect_to book_judge_path(@book)
    else
      render action: :edit
    end
  end

  def update
    @judgement.update(judgement_params)
    if @judgement.save
      redirect_to book_judge_path(@book)
    else
      render action: :edit
    end
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
end
