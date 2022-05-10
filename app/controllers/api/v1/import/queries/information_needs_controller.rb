# frozen_string_literal: true

module Api
  module V1
    module Import
      module Queries
        class InformationNeedsController < Api::ApiController
          before_action :find_case
          before_action :check_case

          # rubocop:disable Metrics/AbcSize
          # rubocop:disable Metrics/CyclomaticComplexity
          # rubocop:disable Metrics/MethodLength
          # rubocop:disable Metrics/PerceivedComplexity
          def create
            # https://github.com/usahg/csv_upload_rails/blob/master/app/controllers/location_controller.rb#L17
            # why importing csv within upload method and not in controller class?
            # it saves memory on the server, if csv is imported in the controller class-
            # everytime any controller method is called an import will be called
            # but, as below, if csv is imported inside upload method, everytime there is a controller call-
            # for "this specific" methods, csv will be imported / required
            require 'csv'

            text = params[:csv_text]

            csv_data = CSV.parse(text, liberal_parsing: true)
            headers = csv_data.shift.map(&:to_s)
            string_data = csv_data.map { |row| row.map(&:to_s) }
            data = string_data.map { |row| Hash[*headers.zip(row).flatten] }

            missing_queries = []

            data.each do |query_input|
              missing_queries << query_input['query_id'] unless Query.exists?(query_input['query_id'])
            end
            if missing_queries.empty?
              data.each do |query_input|
                query = Query.find_by(id: query_input['query_id'])
                query.information_need = query_input['information_need']
                query.save
              end
              render json: { message: 'Success!' }, status: :ok
            else
              render json:   { message: "Didn't find these queries in the database: #{missing_queries.to_sentence}" },
                     status: :unprocessable_entity
            end
          end
          # rubocop:enable Metrics/AbcSize
          # rubocop:enable Metrics/CyclomaticComplexity
          # rubocop:enable Metrics/MethodLength
          # rubocop:enable Metrics/PerceivedComplexity
        end
      end
    end
  end
end
