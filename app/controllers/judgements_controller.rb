# frozen_string_literal: true

class JudgementsController < ApplicationController
  before_action :set_judgement, only: [ :show, :edit, :update, :destroy ]
  before_action :find_book

  def index
    @judgements = @book.judgements.includes([ :query_doc_pair, :user ])
  end

  def show
    @query_doc_pair = @judgement.query_doc_pair
    @query = @current_user.queries.has_information_need.where(query_text: @query_doc_pair.query_text).first
  end

  def skip_judging
    redirect_to book_judge_path(@book)
  end

  # rubocop:disable Layout/LineLength
  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/PerceivedComplexity
  def new
    track_judging = session[:track_judging].symbolize_keys

    track_judging = { book_id: @book.id, counter: 0 } if track_judging.nil? || (track_judging[:book_id] != @book.id)

    track_judging[:counter] = track_judging[:counter] + 1
    session[:track_judging] = track_judging

    @query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(@book, current_user)
    redirect_to book_path(@book) if @query_doc_pair.nil? # no more query doc pairs to be judged!
    if @query_doc_pair
      @query = Query.joins(:case).where(case: { book_id: @query_doc_pair.book.id }).has_information_need.where(query_text: @query_doc_pair.query_text).first
    end
    @judgement = Judgement.new(query_doc_pair: @query_doc_pair, user: @current_user, updated_at: Time.zone.now)
    @previous_judgement = @judgement.previous_judgement_made unless @judgement.new_record?

    if (track_judging[:counter] % 20).zero? # It's party time!
      @party_time = true
      @judged_by_user = @book.judgements.where(user: @current_user).count.to_f
      @total_pool_of_judgements = @book.query_doc_pairs.count.to_f

      @leaderboard_data = []
      unique_judges = @book.judgements.rateable.preload(:user).collect(&:user).uniq
      unique_judges.each do |judge|
        @leaderboard_data << { judge: judge.nil? ? 'anonymous' : judge.name, judgements: @book.judgements.where(user: judge).count }
      end

    end
  end
  # rubocop:enable Layout/LineLength
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/PerceivedComplexity

  def edit
    @query_doc_pair = @judgement.query_doc_pair
    @previous_judgement = @judgement.previous_judgement_made
  end

  def create
    @judgement = Judgement.new(judgement_params)
    @judgement.user = current_user
    @judgement.unrateable = false

    if @judgement.save
      redirect_to book_judge_path(@book)
    else
      render action: :new
    end
  end

  def unrateable
    @judgement = Judgement.find_or_initialize_by(query_doc_pair_id: params[:query_doc_pair_id], user: current_user)

    @judgement.mark_unrateable!
    redirect_to book_judge_path(@book)
  end

  def update
    @judgement.update(judgement_params)
    @judgement.user = current_user
    @judgement.unrateable = false
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
