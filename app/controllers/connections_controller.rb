# frozen_string_literal: true

# Manage the connections to external services (ADR 0005). Anyone who can use a connection can see
# it; only its owner (or, for an instance-wide one, an administrator) can change or delete it,
# because using a connection spends its secret and changing its URL could send that secret
# somewhere else.
class ConnectionsController < ApplicationController
  before_action :set_team, only: [ :new ]
  before_action :set_connection, only: [ :show, :edit, :update, :destroy ]
  before_action :require_manageable, only: [ :edit, :update, :destroy ]

  def index
    @connections = current_user.connections_involved_with.includes(:owner, :teams).order(:name)
    @embedder_counts = Embedder.where(connection_id: @connections.map(&:id)).group(:connection_id).count
  end

  def show
    @embedders = current_user.embedders_involved_with.where(connection_id: @connection.id).order(:name)
  end

  def new
    service = ConnectionService.find('openai')
    @connection = Connection.new(
      service:     service.key,
      base_url:    service.default_base_url,
      auth_scheme: service.auth_scheme,
      auth_header: service.auth_header
    )
    @connection.team_ids = [ @team.id ] if @team
  end

  def edit
  end

  def create
    @connection = Connection.new(connection_params)
    @connection.owner = instance_wide_requested? ? nil : current_user

    if @connection.save
      apply_team_ids(@connection, params.dig(:connection, :team_ids))
      redirect_to edit_connection_path(@connection), notice: 'Connection was successfully created.'
    else
      render :new, status: :unprocessable_content
    end
  end

  def update
    @connection.assign_attributes(connection_params)

    if @connection.save
      apply_team_ids(@connection, params.dig(:connection, :team_ids))
      redirect_to edit_connection_path(@connection), notice: 'Connection was successfully updated.'
    else
      render :edit, status: :unprocessable_content
    end
  end

  # Refused while anything uses it: deleting would leave those embedders without a URL or key.
  def destroy
    in_use = @connection.embedders.count
    if in_use.positive?
      redirect_to connections_path, alert: "#{@connection.name} is used by #{helpers.pluralize(in_use, 'embedder')}. Point them at another connection first."
      return
    end

    @connection.destroy
    redirect_to connections_path, notice: 'Connection was deleted.'
  end

  private

  def set_team
    @team = current_user.teams.find_by(id: params[:team_id])
  end

  def set_connection
    @connection = current_user.connections_involved_with.find_by(id: params[:id])
    return if @connection

    redirect_to connections_path,
                notice: "The connection you are looking for either doesn't exist or you don't have permissions."
  end

  def require_manageable
    return if @connection.manageable_by?(current_user)

    redirect_to connection_path(@connection), alert: 'Only the owner of a connection can change or delete it.'
  end

  # Only an administrator can make a connection that everyone on the instance can use.
  def instance_wide_requested?
    current_user.administrator? && ActiveModel::Type::Boolean.new.cast(params.dig(:connection, :instance_wide))
  end

  # Only touch teams the current user can see, so saving can't unshare the connection from a
  # team the submitting user isn't a member of. Same rule as EmbeddersController#apply_team_ids.
  def apply_team_ids connection, team_ids
    return connection.teams.clear if connection.instance_wide?

    user_teams = current_user.teams.to_a
    selected_ids = Array(team_ids).compact_blank.map(&:to_i)

    kept_teams = connection.teams.reject { |t| user_teams.any? { |ut| ut.id == t.id } }
    selected_teams = user_teams.select { |t| selected_ids.include?(t.id) }
    connection.teams.replace(kept_teams | selected_teams)
  end

  # The form never shows the saved secret, so a blank or masked one means "keep it".
  def connection_params
    permitted = params.expect(connection: Connection::PERMITTED_PARAMS)
    permitted = permitted.except(:secret) if @connection&.persisted? && Connection.keep_existing_secret?(permitted[:secret])
    permitted
  end
end
