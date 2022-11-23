class QueryDocPairsController < ApplicationController
  before_action :set_query_doc_pair, only: [:show, :edit, :update, :destroy]

  respond_to :html

  def index
    @query_doc_pairs = QueryDocPair.all
    respond_with(@query_doc_pairs)
  end

  def show
    respond_with(@query_doc_pair)
  end

  def new
    @query_doc_pair = QueryDocPair.new
    respond_with(@query_doc_pair)
  end

  def edit
  end

  def create
    @query_doc_pair = QueryDocPair.new(query_doc_pair_params)
    @query_doc_pair.save
    respond_with(@query_doc_pair)
  end

  def update
    @query_doc_pair.update(query_doc_pair_params)
    respond_with(@query_doc_pair)
  end

  def destroy
    @query_doc_pair.destroy
    respond_with(@query_doc_pair)
  end

  private
    def set_query_doc_pair
      @query_doc_pair = QueryDocPair.find(params[:id])
    end

    def query_doc_pair_params
      params.require(:query_doc_pair).permit(:user_id, :query_text, :rank, :document_fields, :book_id)
    end
end
