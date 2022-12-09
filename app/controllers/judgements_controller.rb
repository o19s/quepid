# frozen_string_literal: true

class JudgementsController < ApplicationController
  before_action :set_judgement, only: [ :show, :edit, :update, :destroy ]
  before_action :find_book#, only: [ :index ]
  #before_action :check_book, only: [ :index ]

  respond_to :html

  def index
    @judgements = @book.judgements
    respond_with(@judgements)
  end

  def show
    respond_with(@judgement)
  end

  def new
    @judgement = Judgement.new
    respond_with(@judgement)
  end

  def edit
  end

  # rubocop:disable Metrics/MethodLength
  def create
    @judgement = Judgement.new(judgement_params)

    begin
      @judgement.save!
    rescue StandardError => e
      puts e.backtrace
    end

    unless @judgement.query_doc_pair_id.nil?
      @query_doc_pair = QueryDocPair.find(@judgement.query_doc_pair_id)
      @book = Book.find(@query_doc_pair.book_id) if !@query_doc_pair.nil? && !@query_doc_pair.book_id.nil?
    end
    @random_query_doc_pair_id = @book.get_random_query_doc_pair_id(current_user.id)

    if -1 == @random_query_doc_pair_id
      respond_with(@judgement, :location => book_judgements_path)
    else
      respond_with(@judgement,
                   :location => new_book_query_doc_pair_judgement_url(@book,
                                                                      query_doc_pair_id: @random_query_doc_pair_id))
    end
  end
  # rubocop:enable Metrics/MethodLength

  def update
    @judgement.update(judgement_params)
    respond_with(@judgement, :location => book_judgement_path)
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
