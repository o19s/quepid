# frozen_string_literal: true

class JudgementsController < ApplicationController
  before_action :set_judgement, only: [ :show, :edit, :update, :destroy ]
  before_action :find_book

  def index
    @judgements = @book.judgements
  end

  def show
    @query_doc_pair = @judgement.query_doc_pair
    @query = @current_user.queries.has_information_need.where(query_text: @query_doc_pair.query_text).first
  end

  def new
    @query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(@book, current_user)
    redirect_to book_path(@book) if @query_doc_pair.nil? # no more query doc pairs to be judged!
    if @query_doc_pair
      @query = @current_user.queries.has_information_need.where(query_text: @query_doc_pair.query_text).first
    end
    @judgement = Judgement.new
  end

  def edit; end

  def create
    @judgement = Judgement.new(judgement_params)
    @judgement.user = current_user
    @judgement.unrateable = false

    if @judgement.save
      session['previous_judgement_id'] = @judgement.id
      redirect_to book_judge_path(@book)
    else
      render action: :edit
    end
  end

  def unrateable
    @judgement = Judgement.new(query_doc_pair_id: params[:query_doc_pair_id])
    @judgement.user = current_user

    if @judgement.mark_unrateable!
      session['previous_judgement_id'] = @judgement.id
      redirect_to book_judge_path(@book)
    else
      render action: :edit
    end
  end

  def update
    @judgement.update(judgement_params)
    @judgement.user = current_user
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
    params.require(:judgement).permit(:user_id, :rating, :query_doc_pair_id, :unrateable)
  end

  def find_book
    @book = current_user.books_involved_with.where(id: params[:book_id]).first
  end
end
