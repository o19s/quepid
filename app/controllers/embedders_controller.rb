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
      provider:    provider.key,
      service_url: provider.default_service_url,
      model:       provider.default_model
    )
    @embedder.team_ids = [ @team.id ] if @team
  end

  def edit
  end

  # The form never shows a key, so the clone posts back clone_of and #create copies the
  # source's key when none was typed -- a clone works without re-entering it.
  def clone
    @clone_of = @embedder
    @embedder = @embedder.dup
    @embedder.name = "Clone of #{@embedder.name}"
    @embedder.team_ids = [ @team.id ] if @team
    render 'new'
  end

  def create
    @embedder = current_user.owned_embedders.build(embedder_params)
    @clone_of = current_user.embedders_involved_with.find_by(id: params[:clone_of]) if params[:clone_of].present?
    @embedder.api_key = @clone_of.api_key if @clone_of && @embedder.api_key.blank?

    if @embedder.save
      apply_team_ids(@embedder, params.dig(:embedder, :team_ids))
      redirect_to edit_embedder_path(@embedder), notice: 'Embedder was successfully created.'
    else
      render :new, status: :unprocessable_content
    end
  end

  def update
    @embedder.assign_attributes(embedder_params)

    if @embedder.save
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

  # The form never shows the saved key, so a blank or masked key means "keep it".
  def embedder_params
    permitted = params.expect(embedder: [ :name, :provider, :service_url, :model, :api_key, :dimensions,
                                          :truncation, :instruction, :input_template, :timeout ])
    permitted = permitted.except(:api_key) if keep_api_key?(permitted[:api_key])
    permitted
  end

  def keep_api_key? submitted
    @embedder&.persisted? && (submitted.blank? || Embedder::MASKED_API_KEY == submitted)
  end
end
