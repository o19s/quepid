# frozen_string_literal: true

# Manage reusable connections. Private connections are owner-managed; administrators manage
# instance-wide ones. Team members use configured embedders without receiving connection access.
class ConnectionsController < ApplicationController
  include Connections::ParameterFiltering

  before_action :set_connection, only: [ :show, :edit, :update, :destroy ]
  before_action :require_manageable, only: [ :edit, :update, :destroy ]

  def index
    @connections = current_user.connections_involved_with.includes(:owner).order(:name)
    @embedder_counts = Embedder.where(connection_id: @connections.map(&:id)).group(:connection_id).count
  end

  def show
    @embedders = current_user.embedders_involved_with.where(connection_id: @connection.id).order(:name)
  end

  def new
    # The embedder form links here with the provider it wants a connection for.
    provider = ConnectionProvider.find(params.permit(:provider)[:provider]) || ConnectionProvider.find('openai')
    @connection = Connection.new(
      provider:    provider.key,
      base_url:    provider.default_base_url,
      auth_scheme: provider.auth_scheme,
      auth_header: provider.auth_header
    )
  end

  def edit
  end

  def create
    @connection = Connection.new(connection_params)
    @connection.owner = current_user
    @connection.instance_wide = current_user.administrator? && true == deserialize_bool_param(params.dig(:connection, :instance_wide))

    if @connection.save
      redirect_to edit_connection_path(@connection), notice: 'Connection was successfully created.'
    else
      render :new, status: :unprocessable_content
    end
  end

  def update
    @connection.assign_attributes(connection_params)

    if @connection.save
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

  def set_connection
    @connection = current_user.connections_involved_with.find_by(id: params[:id])
    return if @connection

    redirect_to connections_path,
                notice: "The connection you are looking for either doesn't exist or you don't have permissions."
  end

  def require_manageable
    return if @connection.manageable_by?(current_user)

    redirect_to connection_path(@connection), alert: 'Only the owner, or an administrator for an instance-wide connection, can change or delete it.'
  end

  # The form never shows the saved secret, so a blank or masked one means "keep it".
  def connection_params
    permitted = permitted_connection_params
    permitted = permitted.except(:secret) if @connection&.persisted? && Connection.keep_existing_secret?(permitted[:secret])
    permitted
  end
end
