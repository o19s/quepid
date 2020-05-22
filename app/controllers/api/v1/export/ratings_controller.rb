# frozen_string_literal: true

require 'csv'

module Api
  module V1
    module Export
      class RatingsController < Api::ApiController
        before_action :find_case
        before_action :check_case

        def show
          respond_to do |format|
            format.json
            format.csv do
              headers['Content-Disposition'] = "attachment; filename=\"case_#{@case.id}_judgements.csv\""
              headers['Content-Type'] ||= 'text/csv'
            end
          end
        end
      end
    end
  end
end
