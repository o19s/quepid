# frozen_string_literal: true

module Api
  module V1
    class CaseMetadataController < Api::ApiController
      before_action :set_case
      before_action :check_case

      def update
        @metadatum = @case.metadata.find_or_create_by user_id: current_user.id

        if @metadatum.update metadata_params
          head :no_content
        else
          render json: @metadatum.errors, status: :bad_request
        end
      end

      private

      def metadata_params
        params.expect(metadata: [ :last_viewed_at ])
      end
    end
  end
end
