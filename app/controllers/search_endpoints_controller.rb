# frozen_string_literal: true

class SearchEndpointsController < ApplicationController
  include Pagy::Method

  before_action :set_search_endpoint, only: [ :show, :edit, :update, :destroy, :clone, :archive ]

  respond_to :html

  def index
    bool = ActiveRecord::Type::Boolean.new
    @archived = bool.deserialize(params[:archived] || false )

    query = @current_user.search_endpoints_involved_with.order(updated_at: :desc)
    query = query.where(archived: @archived)

    query = query.where(owner_id: current_user.id) if params[:owned].present?
    # for_user matches on ids and does not join teams, so filter by team with its own subquery.
    query = query.where(id: SearchEndpoint.joins(:teams).where(teams: { id: params[:team_id] }).select(:id)) if params[:team_id].present?

    query = query.search_by(params[:q], :name, :endpoint_url) if params[:q].present?

    @pagy, @search_endpoints = pagy(query)
  end

  def show
    respond_with(@search_endpoint)
  end

  def new
    @search_endpoint = SearchEndpoint.new
    respond_with(@search_endpoint)
  end

  def clone
    @cloned_from_id = @search_endpoint.id
    @search_endpoint = @search_endpoint.dup
    @search_endpoint.name = "Clone of #{@search_endpoint.name}"
    respond_with(@search_endpoint)
  end

  def archive
    @search_endpoint.mark_archived!
    redirect_to search_endpoints_path, notice: 'Search Endpoint was archived.'
  end

  def edit
  end

  def create
    @search_endpoint = SearchEndpoint.new(search_endpoint_params.except(:team_ids))
    @search_endpoint.owner = @current_user
    TeamSharing.new(current_user).assign_teams(@search_endpoint, search_endpoint_params[:team_ids])
    restore_cloned_credential

    @search_endpoint.save
    respond_with(@search_endpoint)
  end

  def update
    TeamSharing.new(current_user).assign_teams(@search_endpoint, search_endpoint_params[:team_ids])

    filtered_params = search_endpoint_params.except(:team_ids)
    if filtered_params[:basic_auth_credential].present? &&
       filtered_params[:basic_auth_credential] == @search_endpoint.masked_basic_auth_credential
      filtered_params = filtered_params.except(:basic_auth_credential)
    end

    @search_endpoint.update(filtered_params)
    respond_with(@search_endpoint)
  end

  def destroy
    @search_endpoint.destroy
    redirect_to search_endpoints_path, notice: 'Search Endpoint was deleted.'
  end

  private

  # The clone form shows the source's masked credential (user:******). If it comes back unchanged,
  # copy the real secret from the source instead of storing the placeholder.
  def restore_cloned_credential
    return if params[:clone_of].blank?

    source = current_user.search_endpoints_involved_with.find_by(id: params[:clone_of])
    return if source.nil? || @search_endpoint.basic_auth_credential != source.masked_basic_auth_credential

    @search_endpoint.basic_auth_credential = source.basic_auth_credential
  end

  def set_search_endpoint
    @search_endpoint = current_user.search_endpoints_involved_with.where(id: params[:id]).first
    if @search_endpoint.nil?
      redirect_to :search_endpoints,
                  notice: "Search Endpoint you are looking for either doesn't exist or you don't have permissions."
    end
  end

  def search_endpoint_params
    params.expect(search_endpoint: [ :name, :endpoint_url, :search_engine, :custom_headers,
                                     :api_method, :archived,
                                     :basic_auth_credential, :mapper_code, :proxy_requests,
                                     :options, :requests_per_minute, :test_query,
                                     { team_ids: [] } ])
  end
end
