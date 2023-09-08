# frozen_string_literal: true

class SearchEndpointsController < ApplicationController
  before_action :set_search_endpoint, only: [ :show, :edit, :update, :destroy ]

  respond_to :html

  def index
    @search_endpoints = @current_user.search_endpoints_involved_with
    respond_with(@search_endpoints)
  end

  def show
    respond_with(@search_endpoint)
  end

  def new
    @search_endpoint = SearchEndpoint.new
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
    @search_endpoint.update(search_endpoint_params)
    respond_with(@search_endpoint)
  end

  def destroy
    @search_endpoint.destroy
    respond_with(@search_endpoint)
  end

  private

  def set_search_endpoint
    @search_endpoint = current_user.search_endpoints_involved_with.where(id: params[:id]).first
  end

  def search_endpoint_params
    params.require(:search_endpoint).permit(:name, :endpoint_url, :search_engine, :custom_headers, :api_method)
  end
end
