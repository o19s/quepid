# frozen_string_literal: true

class SearchEndpointsController < ApplicationController
  include Pagy::Backend
  before_action :set_search_endpoint, only: [ :show, :edit, :update, :destroy, :clone ]

  respond_to :html

  def index
    query = @current_user.search_endpoints_involved_with

    query = query.where(teams: { id: params[:team_id] }) if params[:team_id].present?

    if params[:q].present?
      query = query.where('search_endpoints.name LIKE ? OR endpoint_url LIKE ?',
                          "%#{params[:q]}%", "%#{params[:q]}%")
    end

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
    @search_endpoint = @search_endpoint.dup
    @search_endpoint.name = "Clone of #{@search_endpoint.name}"
    respond_with(@search_endpoint)
  end

  def edit
  end

  def create
    @search_endpoint = SearchEndpoint.new(search_endpoint_params)
    @search_endpoint.owner = @current_user

    @search_endpoint.save
    respond_with(@search_endpoint)
  end

  def update
    params_to_use = search_endpoint_params

    params_to_use[:team_ids].compact_blank!

    # this logic is crazy, but basically we don't want to touch the teams that are associated with
    # an endpoint that the current_user CAN NOT see, so we clear out of the relationship all the ones
    # they can see, and then repopulate it from the list of ids checked.  Checkboxes suck.
    team_ids_belonging_to_user = current_user.teams.pluck(:id)
    teams = @search_endpoint.teams.reject { |t| team_ids_belonging_to_user.include?(t.id) }
    @search_endpoint.teams.clear
    params_to_use[:team_ids].each do |team_id|
      teams << Team.find(team_id)
    end

    @search_endpoint.teams.replace(teams)

    @search_endpoint.update(search_endpoint_params.except(:team_ids))
    respond_with(@search_endpoint)
  end

  def destroy
    @search_endpoint.destroy
    respond_with(@search_endpoint)
  end

  private

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
                                     :options,
                                     { team_ids: [] } ])
  end
end
