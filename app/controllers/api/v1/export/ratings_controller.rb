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
          puts "File format is #{file_format}"
          if file_format == 'basic_snapshot'
            @snapshot = Snapshot.find_by_id(params[:snapshot_id])
          end

          respond_to do |format|
            format.json do
              json_template = file_format.nil? ? 'show.json.jbuilder' : "show.#{file_format.downcase}.json.jbuilder"

              render json_template
            end
            format.csv do

              puts "File format is #{file_format}"
              if file_format == 'basic_snapshot'
                csv_filename = "case_#{@case.id}_snapshot_judgements.csv"
              else
                csv_filename = "case_#{@case.id}_judgements.csv"                
              end
              csv_template = "show.#{file_format.downcase}.csv.erb"

              puts "csv_template is #{csv_filename}"
              puts "csv_template is #{csv_filename}"

              headers['Content-Disposition'] = "attachment; filename=\"#{csv_filename}\""
              headers['Content-Type'] ||= 'text/csv'

              render csv_template


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
