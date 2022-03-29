# frozen_string_literal: true

module Api
  module V1
    module Import
      module Queries
        class InformationNeedsController < Api::ApiController
          before_action :find_case
          before_action :check_case

          def create
            # https://github.com/usahg/csv_upload_rails/blob/master/app/controllers/location_controller.rb#L17
            # why importing csv within upload method and not in controller class?
            # it saves memory on the server, if csv is imported in the controller class-
            # everytime any controller method is called an import will be called
            # but, as below, if csv is imported inside upload method, everytime theres a controller call-
            # for "this specific" methods, csv will be imported / required
            require 'csv'

            text = params[:csv_text]

            csv_data = CSV.parse text
            headers = csv_data.shift.map(&:to_s)
            string_data = csv_data.map { |row| row.map(&:to_s) }
            data = string_data.map { |row| Hash[*headers.zip(row).flatten] }
            data.each do |query_input|
              query = Query.find_by(id: query_input['query_id'])
              unless query.nil?
                query.information_need = query_input['information_need']
                query.save
              end
            end

            render json: { message: 'Success!' }, status: :ok
          end

          def create_via_json_data_structure
            # convert from ActionController::Parameters to a Hash, symbolize, and
            # then return just the ratings as an array.
            queries = params.permit(queries: [ :query_id, :query_text,
                                               :information_need ]).to_h.deep_symbolize_keys[:queries]

            begin
              queries.each do |query_input|
                query = Query.find_by(id: query_input[:query_id])
                unless query.nil?
                  query.information_need = query_input[:information_need]
                  query.save
                end
              end

              render json: { message: 'Success!' }, status: :ok
            # rubocop:disable Lint/RescueException
            rescue Exception => e
              # TODO: report this to logging infrastructure so we won't lose any important
              # errors that we might have to fix.
              Rails.logger.debug { "Import query Information Needs failed: #{e.inspect}" }

              render json: { message: e.message }, status: :bad_request
            end
            # rubocop:enable Lint/RescueException
          end
        end
      end
    end
  end
end
