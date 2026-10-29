# frozen_string_literal: true

class EmbeddersController < ApplicationController
  before_action :set_team, only: [ :new, :clone ]
  before_action :set_embedder, only: [ :show, :edit, :update, :destroy, :clone ]

  def index
    @embedders = current_user.embedders_involved_with.includes(:owner, :teams).order(:name)
  end

  def show
    render 'edit'
  end

  def new
    provider = EmbedderProvider.find('openai')
    @embedder = Embedder.new(
      provider:   provider.key,
      model:      provider.default_model,
      connection: current_user.connections_involved_with.not_archived.where(service: provider.key).order(:name).first
    )
    @embedder.team_ids = [ @team.id ] if @team
  end

  def edit
  end

  # The copy keeps the connection, so it works without choosing one again.
  def clone
    @embedder = @embedder.dup
    @embedder.name = "Clone of #{@embedder.name}"
    @embedder.team_ids = [ @team.id ] if @team
    render 'new'
  end

  def create
    @embedder = current_user.owned_embedders.build(embedder_params)

    if usable_connection? && @embedder.save
      apply_team_ids(@embedder, params.dig(:embedder, :team_ids))
      redirect_to edit_embedder_path(@embedder), notice: 'Embedder was successfully created.'
    else
      render :new, status: :unprocessable_content
    end
  end

  def update
    @embedder.assign_attributes(embedder_params)

    if usable_connection? && @embedder.save
      apply_team_ids(@embedder, params.dig(:embedder, :team_ids))
      redirect_to edit_embedder_path(@embedder), notice: 'Embedder was successfully updated.'
    else
      render :edit, status: :unprocessable_content
    end
  end

  def destroy
    @embedder.destroy
    redirect_to embedders_path, notice: 'Embedder was deleted.'
  end

  private

  def set_team
    @team = current_user.teams.find_by(id: params[:team_id])
  end

  def set_embedder
    @embedder = current_user.embedders_involved_with.find_by(id: params[:id])
    return if @embedder

    redirect_to embedders_path,
                notice: "The embedder you are looking for either doesn't exist or you don't have permissions."
  end

  # Only touch teams the current user can see, so saving can't unshare the embedder from a
  # team the submitting user isn't a member of. Same rule as AiJudgesController#apply_team_ids.
  def apply_team_ids embedder, team_ids
    user_teams = current_user.teams.to_a
    selected_ids = Array(team_ids).compact_blank.map(&:to_i)

    kept_teams = embedder.teams.reject { |t| user_teams.any? { |ut| ut.id == t.id } }
    selected_teams = user_teams.select { |t| selected_ids.include?(t.id) }
    embedder.teams.replace(kept_teams | selected_teams)
  end

  # A connection spends its owner's key, so the one picked must be one this user can use -- not
  # merely one the embedder's owner can, since a team member may be editing it. The one already
  # on the embedder stays allowed, so changing the name of an embedder never trips over it.
  def usable_connection?
    id = @embedder.connection_id
    return true if id.nil? || id == @embedder.connection_id_was
    return true if current_user.connections_involved_with.exists?(id: id)

    @embedder.errors.add(:connection, "isn't one you can use")
    false
  end

  # The form never shows the saved key, so a blank or masked key means "keep it".
  def embedder_params
    permitted = params.expect(embedder: Embedder::PERMITTED_PARAMS)
    permitted = permitted.except(:api_key) if keep_api_key?(permitted[:api_key])
    permitted
  end

  def keep_api_key? submitted
    @embedder&.persisted? && Embedder.keep_existing_key?(submitted)
  end
end
