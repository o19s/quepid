# frozen_string_literal: true

require 'application_responder'
require 'analytics'

# rubocop:disable Rails/ApplicationController
module Api
  class ApiController < ActionController::Base
    include Pundit
    include Authentication::CurrentUserManager
    include Authentication::CurrentCaseManager
    include Authentication::CurrentQueryManager
    include Authentication::CurrentTeamManager

    respond_to :json
    before_action :set_default_response_format
    before_action :set_current_user
    before_action :check_current_user_locked!
    before_action :authenticate_api!

    protect_from_forgery with: :null_session

    # Call this API endpoint to test that you have the correct
    # headers set.
    # @return 200 if successful
    def test
      render json: { message: 'Success!' }, status: :ok
    end

    def signup_enabled?
      Rails.application.config.signup_enabled
    end

    protected

    def set_default_response_format
      request.format = :json unless params[:format]
    end
  end
end
# rubocop:enable Rails/ApplicationController
