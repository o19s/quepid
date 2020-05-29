# frozen_string_literal: true

require 'csv'

module Api
  module V1
    module Export
      class RatingsController < Api::ApiController
        before_action :find_case
        before_action :check_case

        def show
          file_format = params[:file_format]

          respond_to do |format|
            format.json do
              json_template = file_format.nil? ? 'show.json.jbuilder' : "show.#{file_format.downcase}.json.jbuilder"

              render json_template
            end
            format.csv do
              headers['Content-Disposition'] = "attachment; filename=\"case_#{@case.id}_judgements.csv\""
              headers['Content-Type'] ||= 'text/csv'
            end
            format.txt do
              headers['Content-Disposition'] = "attachment; filename=\"case_#{@case.id}_judgements.txt\""
              headers['Content-Type'] ||= 'text/plain'
            end
          end
        end
      end
    end
  end
end
