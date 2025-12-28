# frozen_string_literal: true

class QueryDocPairsController < ApplicationController
  include Pagy::Method

  before_action :set_query_doc_pair, only: [ :show, :edit, :update, :destroy ]
  before_action :set_book

  def index
    query = @book.query_doc_pairs

    if params[:q].present?
      query = query.where('query_text LIKE ? OR doc_id LIKE ? OR document_fields LIKE ?',
                          "%#{params[:q]}%", "%#{params[:q]}%", "%#{params[:q]}%")
    end

    @pagy, @query_doc_pairs = pagy(query.order(:query_text))
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
    params.expect(query_doc_pair: [ :query_text, :position, :document_fields, :doc_id, :options, :information_need,
                                    :notes ])
  end
end
