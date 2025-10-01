# frozen_string_literal: true

require 'pagy/extras/array'
class BulkJudgeController < ApplicationController
  include Pagy::Backend

  before_action :set_book

  # GET /books/:book_id/judge/bulk
  def new
    @query_text = params[:query_text]
    @rank_depth = params[:rank_depth].presence&.to_i

    # Default to showing only unrated items unless explicitly set to false
    @only_unrated = params[:only_unrated].nil? || deserialize_bool_param(params[:only_unrated])

    # Default to hiding explanations unless explicitly set to true
    @show_explanations = params[:show_explanations].present? ? deserialize_bool_param(params[:show_explanations]) : false

    # Get available position options for the dropdown
    @available_positions = @book.query_doc_pairs.distinct.pluck(:position).compact.sort

    # Get all query_doc_pairs for this query_text
    query = @book.query_doc_pairs.includes(:judgements)

    # Use LIKE search if query_text is provided to match partial queries
    query = query.where('query_text LIKE ?', "%#{@query_text}%") if @query_text.present?

    # Filter by rank depth if specified
    query = query.where(position: ..@rank_depth) if @rank_depth.present?

    # Filter for unrated items if checkbox is checked
    if @only_unrated
      # Use a subquery to find query_doc_pairs that don't have a rating from the current user
      rated_ids = @book.judgements
        .where(user: current_user)
        .where.not(rating: nil)
        .pluck(:query_doc_pair_id)

      query = query.where.not(id: rated_ids) if rated_ids.any?
    end

    # Order by query_text first, then random within each group
    # We need to get all results first, then group and randomize
    all_results = query.order(:query_text)

    # Group by query_text and randomize within each group
    grouped = all_results.group_by(&:query_text)
    randomized_results = []

    grouped.each_value do |docs|
      randomized_results.concat(docs.shuffle)
    end

    # Now paginate the randomized results
    @pagy, paginated_query_doc_pairs = pagy_array(randomized_results, items: 25)

    # Re-group the paginated results for display
    @grouped_query_doc_pairs = paginated_query_doc_pairs.group_by(&:query_text)

    # Prepare judgements for each query_doc_pair on this page
    @judgements = paginated_query_doc_pairs.to_h do |qdp|
      judgement = qdp.judgements.find_by(user: current_user) ||
                  Judgement.new(query_doc_pair: qdp, user: current_user)
      [ qdp.id, judgement ]
    end

    # Get total counts for display (before pagination)
    @total_count = randomized_results.size
    @total_queries = grouped.keys.size
  end

  # POST /books/:book_id/judge/bulk/save
  # Save individual judgement via AJAX
  def save
    query_doc_pair = @book.query_doc_pairs.find(params[:query_doc_pair_id])
    judgement = Judgement.find_or_initialize_by(
      query_doc_pair_id: query_doc_pair.id,
      user:              current_user
    )

    # Handle reset - clear rating and related flags
    if true == params[:reset]
      judgement.rating = nil
      judgement.unrateable = false
      judgement.judge_later = false
      # Keep explanation if it exists
    elsif params[:rating].present?
      # Update rating only if provided and not resetting
      judgement.rating = params[:rating]
      judgement.unrateable = false
      judgement.judge_later = false
    end

    # Always update explanation if provided
    judgement.explanation = params[:explanation] if params.key?(:explanation)

    if judgement.save
      UpdateCaseRatingsJob.perform_later query_doc_pair
      render json: { status: 'success', judgement_id: judgement.id }
    else
      render json: { status: 'error', errors: judgement.errors.full_messages }, status: :unprocessable_entity
    end
  end
  
  def destroy
    judgement = Judgement.find_or_initialize_by(
      query_doc_pair_id: query_doc_pair.id,
      user:              current_user
    )
    if judgement.destroy
      UpdateCaseRatingsJob.perform_later judgement.query_doc_pair
       render json: { status: 'success', judgement_id: judgement.id }
    else
      render json: { status: 'error', errors: judgement.errors.full_messages }, status: :unprocessable_entity
    end
  end
end
