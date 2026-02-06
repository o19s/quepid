# frozen_string_literal: true

class JudgementsController < ApplicationController
  include Pagy::Method

  before_action :set_judgement, only: [ :show, :edit, :update, :destroy ]
  before_action :set_book

  # rubocop:disable Metrics/AbcSize
  def index
    # compact checkbox: default to checked
    # when form is submitted (filtered param present), use the checkbox value
    @compact = params[:filtered].present? ? params[:compact].present? : true

    query = @book.judgements.includes([ :query_doc_pair, :user ])

    query = query.where(user_id: params[:user_id]) if params[:user_id].present?
    query = query.where(unrateable: true) if params[:unrateable].present?
    query = query.where(judge_later: true) if params[:judge_later].present?

    query = apply_search_filter(query, params[:q]) if params[:q].present?

    @pagy, @judgements = pagy(query.order(:query_doc_pair_id))
  end
  # rubocop:enable Metrics/AbcSize

  def show
    @query_doc_pair = @judgement.query_doc_pair
  end

  def skip_judging
    redirect_to book_judge_path(@book)
  end

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/MethodLength
  def new
    track_judging = session[:track_judging]&.symbolize_keys

    track_judging = { book_id: @book.id, counter: 0 } if track_judging.nil? || (track_judging[:book_id] != @book.id)

    track_judging[:counter] = track_judging[:counter] + 1
    session[:track_judging] = track_judging

    @query_doc_pair = SelectionStrategy.random_query_doc_based_on_strategy(@book, current_user)
    if @query_doc_pair.nil? # no more query doc pairs to be judged!
      redirect_to book_path(@book), notice: 'You have judged all the documents you can!'
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

  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/MethodLength
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

  # rubocop:disable Metrics/MethodLength
  # Parses search query for field-specific filters (e.g., "query_doc_pair_id:123 doc_id:abc")
  # Supported fields: query_doc_pair_id, doc_id, query_text
  # Any text not matching a field filter is used for generic LIKE search
  def apply_search_filter query, search_term
    field_filters = {
      'query_doc_pair_id' => nil,
      'doc_id'            => nil,
      'query_text'        => nil,
    }

    remaining_text = search_term.dup

    # Extract field:value patterns
    field_filters.each_key do |field|
      pattern = /#{field}:(\S+)/i
      if remaining_text =~ pattern
        field_filters[field] = ::Regexp.last_match(1)
        remaining_text = remaining_text.gsub(pattern, '').strip
      end
    end

    # Apply exact field filters
    query = query.where(query_doc_pair_id: field_filters['query_doc_pair_id']) if field_filters['query_doc_pair_id']
    query = query.where(query_doc_pairs: { doc_id: field_filters['doc_id'] }) if field_filters['doc_id']
    query = query.where(query_doc_pairs: { query_text: field_filters['query_text'] }) if field_filters['query_text']

    # Apply generic LIKE search for remaining text
    if remaining_text.present?
      query = query.where(
        'query_doc_pair_id LIKE ? OR doc_id LIKE ? OR query_text LIKE ? OR information_need LIKE ? OR judgements.explanation LIKE ?',
        "%#{remaining_text}%", "%#{remaining_text}%", "%#{remaining_text}%", "%#{remaining_text}%", "%#{remaining_text}%"
      )
    end

    query
  end
  # rubocop:enable Metrics/MethodLength
end
