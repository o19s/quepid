# frozen_string_literal: true

class Scorers2Controller < ApplicationController
  include Pagy::Method

  # Show the scorers page (server-side rendering)
  def index
    @q = params[:q]
    @scorer_type = params[:scorer_type]
    @scorer_type_list = Array(@scorer_type).reject(&:blank?)

    # combined scorers: custom (communal = false) first, then communal scorers
    combined_query = Scorer.for_user(current_user).includes(:owner, :teams)
    if @scorer_type_list.size == 1
      if @scorer_type_list.first == 'communal'
        combined_query = combined_query.where(communal: true)
      elsif @scorer_type_list.first == 'custom'
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

  # Fragment endpoint for communal scorers
  def communal_fragment
    @q = params[:q].to_s.strip
    @communal_scorers = Scorer.communal.order(:name)
    @communal_scorers = @communal_scorers.where('name LIKE ?', "%#{@q}%") if @q.present?
    render template: 'scorers2/communal_fragment', layout: false
  end

  # Fragment endpoint for custom scorers
  def custom_fragment
    @q = params[:q].to_s.strip
    custom_query = Scorer.for_user(current_user).where(communal: false).order(:name)
    custom_query = custom_query.where('name LIKE ?', "%#{@q}%") if @q.present?
    @pagy_custom, @custom_scorers = pagy(custom_query)
    render template: 'scorers2/custom_fragment', layout: false
  end

  # Update the current user's default scorer (regular form post)
  def update_default
    scorer_id = params[:default_scorer_id]
    scorer = Scorer.find_by(id: scorer_id)

    unless scorer
      flash[:alert] = 'Scorer not found.'
      redirect_to scorers2_path and return
    end

    # ensure the user has access to this scorer
    allowed_ids = Scorer.for_user(current_user).pluck(:id)
    unless allowed_ids.include?(scorer.id)
      flash[:alert] = 'You cannot select that scorer as default.'
      redirect_to scorers2_path and return
    end

    current_user.default_scorer = scorer
    if current_user.save
      flash[:notice] = 'Default scorer updated.'
    else
      flash[:alert] = current_user.errors.full_messages.to_sentence
    end

    redirect_to scorers2_path
  end

  def share
    team = current_user.teams.find_by(id: params[:team_id])
    scorer = Scorer.find_by(id: params[:scorer_id])

    unless team && scorer
      flash[:alert] = 'Team or scorer not found.'
      redirect_to scorers2_path and return
    end

    unless Scorer.for_user(current_user).where(id: scorer.id).exists?
      flash[:alert] = 'You do not have access to that scorer.'
      redirect_to scorers2_path and return
    end

    if scorer.communal?
      flash[:alert] = 'Communal scorers are already available to everyone.'
      redirect_to scorers2_path and return
    end

    if team.scorers.exists?(scorer.id)
      flash[:alert] = "#{scorer.name} is already shared with #{team.name}."
    else
      team.scorers << scorer
      flash[:notice] = "#{scorer.name} shared with #{team.name}."
      Analytics::Tracker.track_scorer_shared_event current_user, scorer, team if defined?(Analytics::Tracker) && Analytics::Tracker.respond_to?(:track_scorer_shared_event)
    end

    redirect_to scorers2_path, status: :see_other
  end

  def unshare
    team = current_user.teams.find_by(id: params[:team_id])
    scorer = Scorer.find_by(id: params[:scorer_id])

    unless team && scorer
      flash[:alert] = 'Team or scorer not found.'
      redirect_to scorers2_path and return
    end

    unless Scorer.for_user(current_user).where(id: scorer.id).exists?
      flash[:alert] = 'You do not have access to that scorer.'
      redirect_to scorers2_path and return
    end

    if scorer.communal?
      flash[:alert] = 'Communal scorers are already available to everyone.'
      redirect_to scorers2_path and return
    end

    if team.scorers.exists?(scorer.id)
      team.scorers.delete(scorer)
      flash[:notice] = "#{scorer.name} unshared from #{team.name}."
    else
      flash[:alert] = "#{scorer.name} is not shared with #{team.name}."
    end

    redirect_to scorers2_path, status: :see_other
  end
end
