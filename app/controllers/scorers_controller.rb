# frozen_string_literal: true

class ScorersController < ApplicationController
  include Pagy::Method

  before_action :set_scorer, only: [ :edit, :update, :destroy, :test ]
  before_action :set_source_scorer, only: [ :clone ]

  # Show the scorers page (server-side rendering)
  def index
    @q = params[:q]
    @scorer_type = params[:scorer_type]
    @scorer_type_list = Array(@scorer_type).compact_blank

    # combined scorers: custom (communal = false) first, then communal scorers
    combined_query = Scorer.for_user(current_user).includes(:owner, :teams)
    if 1 == @scorer_type_list.size
      if 'communal' == @scorer_type_list.first
        combined_query = combined_query.where(communal: true)
      elsif 'custom' == @scorer_type_list.first
        combined_query = combined_query.where(communal: false)
      end
    end
    combined_query = combined_query.where('scorers.name LIKE ?', "%#{@q}%") if @q.present?
    # Order so that communal (true) comes after custom (false)
    combined_query = combined_query.order(Arel.sql('communal ASC, name'))

    @pagy, @scorers = pagy(combined_query)
    @combined_scorers = Scorer.for_user(current_user).order(Arel.sql('communal ASC, name'))
    @user_teams = current_user.teams.order(:name)

    @default_scorer = current_user.default_scorer

    @communal_count = Scorer.communal.count
    @custom_count = Scorer.for_user(current_user).where(communal: false).count
  end

  def new
    @scorer = Scorer.new(owner: current_user, communal: false)
  end

  def edit
  end

  def create
    @scorer = Scorer.new(scorer_params.merge(owner: current_user, communal: false))
    if @scorer.save
      redirect_to edit_scorer_path(@scorer), notice: 'Scorer created.'
    else
      render :new, status: :unprocessable_content
    end
  end

  def clone
    @scorer = @source_scorer.dup
    @scorer.owner = current_user
    @scorer.communal = false
    @scorer.name = "Clone of #{@source_scorer.name}"
    @scorer.code = @source_scorer.code
    @scorer.scale = @source_scorer.scale
    @scorer.scale_with_labels = @source_scorer.scale_with_labels
    @scorer.show_scale_labels = @source_scorer.show_scale_labels

    if @scorer.save
      redirect_to edit_scorer_path(@scorer), notice: 'Scorer cloned.'
    else
      redirect_to scorers_path, alert: 'Unable to clone scorer.'
    end
  end

  # Update the current user's default scorer (regular form post)
  def update_default
    scorer_id = params[:default_scorer_id]
    scorer = Scorer.find_by(id: scorer_id)

    unless scorer
      flash[:alert] = 'Scorer not found.'
      redirect_to scorers_path and return
    end

    # ensure the user has access to this scorer
    allowed_ids = Scorer.for_user(current_user).pluck(:id)
    unless allowed_ids.include?(scorer.id)
      flash[:alert] = 'You cannot select that scorer as default.'
      redirect_to scorers_path and return
    end

    current_user.default_scorer = scorer
    if current_user.save
      flash[:notice] = 'Default scorer updated.'
    else
      flash[:alert] = current_user.errors.full_messages.to_sentence
    end

    redirect_to scorers_path
  end

  def share
    team = current_user.teams.find_by(id: params[:team_id])
    scorer = Scorer.find_by(id: params[:scorer_id])

    unless team && scorer
      flash[:alert] = 'Team or scorer not found.'
      redirect_to scorers_path and return
    end

    unless Scorer.for_user(current_user).exists?(id: scorer.id)
      flash[:alert] = 'You do not have access to that scorer.'
      redirect_to scorers_path and return
    end

    if scorer.communal?
      flash[:alert] = 'Communal scorers are already available to everyone.'
      redirect_to scorers_path and return
    end

    if team.scorers.exists?(scorer.id)
      flash[:alert] = "#{scorer.name} is already shared with #{team.name}."
    else
      team.scorers << scorer
      flash[:notice] = "#{scorer.name} shared with #{team.name}."
      Analytics::Tracker.track_scorer_shared_event current_user, scorer, team if defined?(Analytics::Tracker) && Analytics::Tracker.respond_to?(:track_scorer_shared_event)
    end

    redirect_to scorers_path, status: :see_other
  end

  def unshare
    team = current_user.teams.find_by(id: params[:team_id])
    scorer = Scorer.find_by(id: params[:scorer_id])

    unless team && scorer
      flash[:alert] = 'Team or scorer not found.'
      redirect_to scorers_path and return
    end

    unless Scorer.for_user(current_user).exists?(id: scorer.id)
      flash[:alert] = 'You do not have access to that scorer.'
      redirect_to scorers_path and return
    end

    if scorer.communal?
      flash[:alert] = 'Communal scorers are already available to everyone.'
      redirect_to scorers_path and return
    end

    if team.scorers.exists?(scorer.id)
      team.scorers.delete(scorer)
      flash[:notice] = "#{scorer.name} unshared from #{team.name}."
    else
      flash[:alert] = "#{scorer.name} is not shared with #{team.name}."
    end

    redirect_to scorers_path, status: :see_other
  end

  def update
    if @scorer.communal? && !current_user.administrator?
      redirect_to scorers_path, alert: 'You cannot edit communal scorers.'
      return
    end

    if @scorer.update(scorer_params)
      redirect_to edit_scorer_path(@scorer), notice: 'Scorer updated.'
    else
      render :edit, status: :unprocessable_content
    end
  end

  def destroy
    if @scorer.communal? && !current_user.administrator?
      redirect_to scorers_path, alert: 'You cannot delete communal scorers.'
      return
    end

    @scorer.destroy
    redirect_to scorers_path, notice: 'Scorer deleted.'
  end

  # POST scorers/:id/test
  # Runs the scorer code (from params or scorer) against sample docs. Returns JSON.
  # Body: { code?: string } — optional; when omitted, uses scorer's saved code.
  def test
    if @scorer.communal? && !current_user.administrator?
      render json: { error: 'You cannot test communal scorers.' }, status: :forbidden
      return
    end

    code = params[:code].presence || @scorer.code
    if code.blank?
      render json: { error: 'No scorer code to run.' }, status: :bad_request
      return
    end

    # Sample docs: 10 docs with mixed ratings (same format as FetchService)
    docs = (1..10).map do |i|
      rating = case i
               when 1, 3, 5 then 3
               when 2, 6 then 2
               when 4, 7 then 1
               else 0
               end
      { id: "doc#{i}", rating: rating }
    end
    best_docs = docs.select { |d| d[:rating] > 0 }.sort_by { |d| -d[:rating] }

    javascript_scorer = JavascriptScorer.new(Rails.root.join('lib/scorer_logic.js'))
    score = javascript_scorer.score(docs, best_docs, code)
    render json: { score: score }
  rescue JavascriptScorer::ScoreError => e
    render json: { error: e.message }, status: :unprocessable_entity
  end

  private

  def set_scorer
    @scorer = if current_user.administrator?
                Scorer.for_user(current_user).find(params[:id])
              else
                Scorer.for_user(current_user).where(communal: false).find(params[:id])
              end
  end

  def set_source_scorer
    @source_scorer = Scorer.for_user(current_user).find(params[:id])
  end

  def scorer_params
    params.expect(
      scorer: [ :name,
                :code,
                :scale_list,
                :show_scale_labels,
                { scale_with_labels: {} } ]
    )
  end
end
