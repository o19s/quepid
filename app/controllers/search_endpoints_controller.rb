# frozen_string_literal: true

class SearchEndpointsController < ApplicationController
  include Pagy::Method

  before_action :set_search_endpoint, only: [ :show, :edit, :update, :destroy, :clone, :archive ]

  respond_to :html

  def index
    bool = ActiveRecord::Type::Boolean.new
    @archived = bool.deserialize(params[:archived] || false )

    # The free-text search now lives under the nested q[...] ransack hash
    # (q[name_downcase_or_endpoint_url_downcase_cont]) rather than a plain
    # top-level q string - sort_link's links are q[s]=..., and params[:q]
    # can't be both a Hash (sort) and a String (free text) at once.
    # name_downcase_or_endpoint_url_downcase_cont needs a downcased value -
    # the ransackers downcase the columns (see the ransacker comments on
    # SearchEndpoint). owned isn't a plain column match (the value comes from
    # current_user, not the request), so it stays a manual filter applied
    # after ransack rather than a ransack predicate.
    ransack_params = params[:q].present? ? params[:q].to_unsafe_h : {}
    if ransack_params[:name_downcase_or_endpoint_url_downcase_cont].present?
      ransack_params[:name_downcase_or_endpoint_url_downcase_cont] =
        ransack_params[:name_downcase_or_endpoint_url_downcase_cont].downcase
    end
    ransack_params[:archived_eq] = @archived
    ransack_params[:teams_id_eq] = params[:team_id] if params[:team_id].present?

    @q = @current_user.search_endpoints_involved_with.ransack(ransack_params)
    # Default sort until the user clicks a column header (sort_link in the
    # view drives @q.sorts from here on).
    @q.sorts = 'updated_at desc' if @q.sorts.empty?

    query = @q.result
    query = query.where(owner_id: current_user.id) if params[:owned].present?

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

  def archive
    @search_endpoint.mark_archived!
    redirect_to search_endpoints_path, notice: 'Search Endpoint was archived.'
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
    params_to_use[:team_ids] = params_to_use.fetch(:team_ids, []).compact_blank

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
