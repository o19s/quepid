# frozen_string_literal: true

module DatasetCaseIndexes
  # Checks the definition the user agreed to as create would, and sends nothing anywhere: for an endpoint only the
  # browser can reach, the browser asks this before it sends the definition to the endpoint itself, so an edit Quepid
  # would refuse (a Solr delete-field, a name unsafe for an address) never gets there.
  class ValidationsController < ApplicationController
    include DatasetCaseScoped

    def create
      DatasetIndex::Review.new(@link, @endpoint).agreed!(index_name: params[:index_name], text: params[:definition])
      head :no_content
    rescue DatasetIndex::Error => e
      render json: { error: e.message }, status: :unprocessable_content
    end
  end
end
