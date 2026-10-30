# frozen_string_literal: true

module DatasetCases
  # Points a case made from a dataset at one of the user's search endpoints, where the dataset is already hosted,
  # without creating or loading anything.
  class SearchEndpointsController < ApplicationController
    include DatasetCaseScoped

    def update
      @kase.tries.first.update!(search_endpoint: @endpoint)
      redirect_to dataset_cases_path, notice: "#{@kase.case_name} now searches #{@endpoint.fullname}.", status: :see_other
    end
  end
end
