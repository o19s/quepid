# frozen_string_literal: true

module Api
  module V1
    module Cases
      class JobsController < Api::ApiController
        def trigger
          kase = Case.find(4)
          RunCaseJob2.perform_later kase.owner, kase, root_url

          render json: { message: 'scheduled' }, status: :ok
        end
      end
    end
  end
end
