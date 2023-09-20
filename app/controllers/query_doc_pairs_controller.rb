# frozen_string_literal: true

class QueryDocPairsController < ApplicationController
  before_action :set_query_doc_pair, only: [ :show, :edit, :update, :destroy ]
  before_action :find_book

  def index
    @query_doc_pairs = @book.query_doc_pairs.order(:query_text )
  end

  def show; end

  def new
    @query_doc_pair = QueryDocPair.new
  end

  def edit; end

  def create
    @query_doc_pair = QueryDocPair.new query_doc_pair_params
    @book.query_doc_pairs << @query_doc_pair
    if @book.save
      redirect_to book_query_doc_pairs_path(@book, @query_doc_pair)
    else
      render action: :new
    end
  end

  def update
    @query_doc_pair.update query_doc_pair_params
    if @query_doc_pair.save
      redirect_to book_query_doc_pairs_path(@book, @query_doc_pair)
    else
      render action: :edit
    end
  end

  def destroy
    @query_doc_pair.destroy
    redirect_to book_path(@book)
  end

  private

  def set_query_doc_pair
    @query_doc_pair = QueryDocPair.find(params[:id])
  end

  def query_doc_pair_params
    params.require(:query_doc_pair).permit(:query_text, :position, :document_fields, :doc_id)
  end
end
