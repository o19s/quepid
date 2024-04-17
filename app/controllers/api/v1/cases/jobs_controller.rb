# frozen_string_literal: true

module Api
  module V1
    module Cases
      class JobsController < Api::ApiController
        before_action :set_case
        before_action :check_case
        def trigger
          RunCaseJob2.perform_later @current_user, @case, root_url

          render json: { message: 'scheduled' }, status: :ok
        end
      end
    end
  end
end
