# frozen_string_literal: true

class BulkJudgeController < ApplicationController
  include Pagy::Method

  before_action :set_book

  # GET /books/:book_id/judge/bulk
  # rubocop:disable-next Metrics/AbcSize, Metrics/CyclomaticComplexity, Metrics/MethodLength, Metrics/PerceivedComplexity
  def new
    @query_text = params[:query_text]
    @rank_depth = params[:rank_depth].presence&.to_i || @book.rank_depth

    # Default to showing only unrated items unless explicitly set to false
    @only_unrated = params[:only_unrated].nil? || deserialize_bool_param(params[:only_unrated])

    # Default to hiding explanations unless explicitly set to true
    @show_explanations = params[:show_explanations].present? ? deserialize_bool_param(params[:show_explanations]) : false

    @available_positions = @book.query_doc_pairs.distinct.pluck(:position).compact.sort

    # Get all query_doc_pairs for this query_text, already scoped to rank depth
    query = @book.query_doc_pairs_within_rank_depth(@rank_depth).includes(:judgements)

    # Use LIKE search if query_text is provided to match partial queries
    query = query.where('LOWER(query_text) LIKE ?', "%#{@query_text.to_s.downcase}%") if @query_text.present?

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

    @pagy, paginated_query_doc_pairs = pagy(randomized_results, items: 25, page: params[:page])

    # If you rate a bunch of documents, and we're filtering to just unrated docs,
    # then you may not have enough docs left to fill the last page.  In that we
    # just back up a page, and render.  And the pagy navbar is just skipped in
    # the footer.
    unless @pagy.in_range?
      page = @pagy.page - 1
      @pagy, paginated_query_doc_pairs = pagy(randomized_results, items: 25, page: page)
    end

    @grouped_query_doc_pairs = paginated_query_doc_pairs.group_by(&:query_text)

    # Prepare judgements for each query_doc_pair on this page
    @judgements = paginated_query_doc_pairs.to_h do |qdp|
      judgement = qdp.judgements.find_by(user: current_user) ||
                  Judgement.new(query_doc_pair: qdp, user: current_user)
      [ qdp.id, judgement ]
    end

    @total_count = randomized_results.size
    @total_queries = grouped.keys.size
  end

  # POST /books/:book_id/judge/bulk/save
  # Save individual judgement via AJAX
  def save
    query_doc_pair = @book.query_doc_pairs.find(params.expect(:query_doc_pair_id))
    judgement = Judgement.find_or_initialize_by(
      query_doc_pair_id: query_doc_pair.id,
      user:              current_user
    )

    # Handle reset - destroy the judgement entirely
    if deserialize_bool_param(params[:reset])
      if judgement.persisted?
        judgement.destroy
        broadcast_judgement_change query_doc_pair, current_user
      end
      render json: { status: 'success' }
    else
      # Update rating if provided
      if params[:rating].present?
        judgement.rating = params[:rating]
        judgement.unrateable = false
        judgement.judge_later = false
      end

      # Always update explanation if provided
      judgement.explanation = params[:explanation] if params.key?(:explanation)

      if judgement.save
        broadcast_judgement_change query_doc_pair, current_user
        render json: { status: 'success', judgement_id: judgement.id }
      else
        render json: { status: 'error', errors: judgement.errors.full_messages }, status: :unprocessable_content
      end
    end
  end

  def destroy
    judgement = Judgement.find_by(
      query_doc_pair_id: params[:query_doc_pair_id],
      user:              current_user
    )

    if judgement&.destroy
      broadcast_judgement_change judgement.query_doc_pair, current_user
      render json: { status: 'success' }
    else
      render json: { status: 'error', message: 'Judgement not found or could not be deleted' }, status: :not_found
    end
  end

  private

  # Every judgement mutation needs both: sync the case ratings this pair
  # feeds into, and refresh the book overview's live Judge Activity table.
  def broadcast_judgement_change query_doc_pair, judge
    UpdateCaseRatingsJob.perform_later query_doc_pair
    BroadcastJudgeActivityJob.perform_later(@book, judge)
  end
end
