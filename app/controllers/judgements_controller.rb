# frozen_string_literal: true

# rubocop:disable Metrics/ClassLength
class JudgementsController < ApplicationController
  include Pagy::Backend
  before_action :set_judgement, only: [ :show, :edit, :update, :destroy ]
  before_action :set_book

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Layout/LineLength
  def index
    bool = ActiveRecord::Type::Boolean.new
    @shallow = bool.deserialize(params[:shallow] || true )

    query = @book.judgements.includes([ :query_doc_pair, :user ])

    query = query.where(user_id: params[:user_id]) if params[:user_id].present?
    query = query.where(unrateable: true) if params[:unrateable].present?
    query = query.where(judge_later: true) if params[:judge_later].present?

    if params[:q].present?
      query = query.where('doc_id LIKE ? OR query_text LIKE ? OR information_need LIKE ? OR judgements.explanation LIKE ?',
                          "%#{params[:q]}%", "%#{params[:q]}%", "%#{params[:q]}%", "%#{params[:q]}%")
    end

    @pagy, @judgements = pagy(query.order('query_doc_pair_id'))
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Layout/LineLength

  def show
    @query_doc_pair = @judgement.query_doc_pair
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
    track_judging = session[:track_judging]&.symbolize_keys

    track_judging = { book_id: @book.id, counter: 0 } if track_judging.nil? || (track_judging[:book_id] != @book.id)

    track_judging[:counter] = track_judging[:counter] + 1
    session[:track_judging] = track_judging

    @query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(@book, current_user)
    if @query_doc_pair.nil? # no more query doc pairs to be judged!
      redirect_to book_path(@book)
    else
      # NO LONGER USED
      # if @query_doc_pair
      #   @query = Query.joins(:case).where(case: { book_id: @query_doc_pair.book.id }).has_information_need.where(query_text: @query_doc_pair.query_text).first
      # end
      @judgement = Judgement.new(query_doc_pair: @query_doc_pair, user: @current_user, updated_at: Time.zone.now)
      @previous_judgement = @judgement.previous_judgement_made # unless @judgement.new_record?
      if (track_judging[:counter] % 50).zero? # It's party time!
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

  # rubocop:disable Metrics/MethodLength
  def create
    @judgement = Judgement.new(judgement_params)
    @judgement.user = current_user
    @judgement.unrateable = false

    # Make sure that we haven't already created the same judgement before
    # This create UI can happen very quickly, and somehow we get overlapping creates..
    if !@judgement.valid? && (@judgement.errors.added? :user_id, :taken, value: @current_user.id)
      @judgement = Judgement.find_by(user_id: @current_user.id, query_doc_pair_id: @judgement.query_doc_pair_id)
      @judgement.update(judgement_params)
      @judgement.user = current_user
      @judgement.unrateable = false
    end

    if @judgement.save
      UpdateCaseRatingsJob.perform_later @judgement.query_doc_pair
      redirect_to book_judge_path(@book)
    else
      @query_doc_pair = @judgement.query_doc_pair
      render action: :new
    end
  end
  # rubocop:enable Metrics/MethodLength

  def unrateable
    @judgement = Judgement.find_or_initialize_by(query_doc_pair_id: params[:query_doc_pair_id], user: current_user)
    @judgement.update(judgement_params)

    @judgement.mark_unrateable!
    UpdateCaseRatingsJob.perform_later @judgement.query_doc_pair
    redirect_to book_judge_path(@book)
  end

  def judge_later
    @judgement = Judgement.find_or_initialize_by(query_doc_pair_id: params[:query_doc_pair_id], user: current_user)

    @judgement.mark_judge_later!
    UpdateCaseRatingsJob.perform_later @judgement.query_doc_pair
    redirect_to book_judge_path(@book)
  end

  def update
    @judgement.update(judgement_params)
    @judgement.user = current_user
    @judgement.unrateable = false
    if @judgement.save
      UpdateCaseRatingsJob.perform_later @judgement.query_doc_pair
      redirect_to book_judge_path(@book)
    else
      render action: :edit
    end
  end

  def destroy
    @judgement.destroy
    UpdateCaseRatingsJob.perform_later @judgement.query_doc_pair
    redirect_to book_judge_path(@book), notice: "Removed rating for query '#{@judgement.query_doc_pair.query_text}'."
  end

  private

  def set_judgement
    @judgement = Judgement.find(params[:id])
  end

  def judgement_params
    params.expect(judgement: [ :user_id, :rating, :query_doc_pair_id, :unrateable, :explanation ])
  end
end
# rubocop:enable Metrics/ClassLength
