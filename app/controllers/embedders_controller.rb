# frozen_string_literal: true

class EmbeddersController < ApplicationController
  include TeamAssignable

  before_action :set_team, only: [ :new, :clone ]
  before_action :set_embedder, only: [ :show, :edit, :update, :destroy, :clone ]

  def index
    @selectable_connection_ids = current_user.connections_involved_with.pluck(:id)
    @embedders = current_user.embedders_involved_with.includes(:owner, :teams, :connection).order(:name)
  end

  def show
    render 'edit'
  end

  def new
    @embedder = Embedder.new
    @embedder.team_ids = [ @team.id ] if @team
  end

  def edit
  end

  # A copy can reuse an owned or instance-wide connection. A teammate must choose their
  # own connection when the original uses its owner's private credentials.
  def clone
    @embedder = @embedder.dup
    @embedder.name = "Clone of #{@embedder.name}"
    unless current_user.connections_involved_with.exists?(id: @embedder.connection_id)
      @embedder.connection = nil
      flash.now[:notice] = 'Choose a connection you own or an instance-wide connection for this copy.'
    end
    @embedder.team_ids = [ @team.id ] if @team
    render 'new'
  end

  def create
    @embedder = current_user.owned_embedders.build(embedder_params)
    @embedder.connection_assignment_user = current_user

    if @embedder.save
      apply_team_ids(@embedder, params.dig(:embedder, :team_ids))
      redirect_to edit_embedder_path(@embedder), notice: 'Embedder was successfully created.'
    else
      render :new, status: :unprocessable_content
    end
  end

  def update
    if @embedder.update(embedder_params)
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
    if @embedder
      @embedder.connection_assignment_user = current_user
      return
    end

    redirect_to embedders_path,
                notice: "The embedder you are looking for either doesn't exist or you don't have permissions."
  end

  def embedder_params
    params.expect(embedder: Embedder::PERMITTED_PARAMS)
  end
end
