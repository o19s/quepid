# frozen_string_literal: true

require 'csv'

module Api
  module V1
    module Export
      class RatingsController < Api::ApiController
        before_action :find_case
        before_action :check_case

        # rubocop:disable Metrics/MethodLength
        def show
          file_format = params[:file_format]

          respond_to do |format|
            format.json do
              json_template = file_format.nil? ? 'show.json.jbuilder' : "show.#{file_format.downcase}.json.jbuilder"

              render json_template
            end
            format.csv do
              if 'basic_snapshot' == file_format
                csv_filename = "case_#{@case.id}_snapshot_judgements.csv"
                @snapshot = Snapshot.find_by(id: params[:snapshot_id])
              else
                csv_filename = "case_#{@case.id}_judgements.csv"
              end

              headers['Content-Disposition'] = "attachment; filename=\"#{csv_filename}\""
              headers['Content-Type'] ||= 'text/csv'

              render "show.#{file_format.downcase}.csv.erb"
            end
            format.txt do
              headers['Content-Disposition'] = "attachment; filename=\"case_#{@case.id}_judgements.txt\""
              headers['Content-Type'] ||= 'text/plain'
            end
          end
        end
        # rubocop:enable Metrics/MethodLength
      end
    end
  end
end
