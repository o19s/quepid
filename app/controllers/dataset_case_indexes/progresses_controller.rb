# frozen_string_literal: true

module DatasetCaseIndexes
  # How far the browser has got in loading a case's documents into its index, for the Dataset Cases tab.
  class ProgressesController < ApplicationController
    include DatasetCaseScoped

    def update
      @link.record_progress!(status: params[:status], documents_indexed: params[:documents_indexed], error: params[:error])
      head :no_content
    end
  end
end
