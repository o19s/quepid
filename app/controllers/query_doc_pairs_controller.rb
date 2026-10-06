# frozen_string_literal: true

class QueryDocPairsController < ApplicationController
  include Pagy::Method

  before_action :set_book
  before_action :set_query_doc_pair, only: [ :show, :edit, :update, :destroy ]

  def index
    @include_judgement_count = deserialize_bool_param(params[:include_judgement_count])

    # m: 'or' combines independently-predicated conditions (three _cont plus
    # one _eq on id) - Ransack's attribute-grouping (_or_) only works when
    # every side shares the same predicate.
    ransack_params = params[:q].present? ? params[:q].to_unsafe_h : {}
    if params[:search].present?
      term = params[:search].to_s
      ransack_params[:m] = 'or'
      ransack_params[:query_text_cont] = term
      ransack_params[:id_eq] = term.to_i
      ransack_params[:doc_id_cont] = term
      ransack_params[:document_fields_cont] = term
    end

    @q = @book.query_doc_pairs.ransack(ransack_params)
    @q.sorts = 'query_text asc' if @q.sorts.empty?
    query = @q.result

    # Eager load judgements count to avoid N+1 queries when showing the count
    query = query.left_joins(:judgements).select('query_doc_pairs.*, COUNT(judgements.id) AS judgements_count').group('query_doc_pairs.id') if @include_judgement_count

    @pagy, @query_doc_pairs = pagy(query)
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
      redirect_to book_query_doc_pair_path(@book, @query_doc_pair)
    else
      render action: :new, status: :unprocessable_content
    end
  end

  def update
    if @query_doc_pair.update query_doc_pair_params
      redirect_to book_query_doc_pair_path(@book, @query_doc_pair)
    else
      render action: :edit, status: :unprocessable_content
    end
  end

  def destroy
    @query_doc_pair.destroy
    redirect_to book_path(@book)
  end

  private

  def set_query_doc_pair
    @query_doc_pair = @book.query_doc_pairs.find(params.expect(:id))
  end

  def query_doc_pair_params
    params.expect(query_doc_pair: [ :query_text, :position, :document_fields, :doc_id, :options, :information_need,
                                    :notes ])
  end
end
