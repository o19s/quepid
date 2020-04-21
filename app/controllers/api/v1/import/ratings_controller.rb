# frozen_string_literal: true

module Api
  module V1
    module Import
      class RatingsController < Api::ApiController
        before_action :find_case
        before_action :check_case

        def create
          options = {
            format:         :hash,
            force:          true,
            clear_existing: params[:clear_queries] || false,
          }

          service = RatingsImporter.new @case, params[:ratings], options

          begin
            service.import

            render json: { message: 'Success!' }, status: :ok
          # rubocop:disable Lint/RescueException
          rescue Exception => e
            # TODO: report this to logging infrastructure so we won't lose any important
            # errors that we might have to fix.
            Rails.logger.debug "Import ratings failed: #{e.inspect}"

            render json: { message: e.message }, status: :bad_request
          end
          # rubocop:enable Lint/RescueException
        end
      end
    end
  end
end
