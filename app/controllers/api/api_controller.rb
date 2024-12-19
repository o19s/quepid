# frozen_string_literal: true

require_relative '../../lib/analytics'

# rubocop:disable Rails/ApplicationController
module Api
  class ApiController < ActionController::Base
    include Pundit::Authorization
    include Authentication::CurrentUserManager
    include Authentication::CurrentCaseManager
    include Authentication::CurrentQueryManager
    include Authentication::CurrentTeamManager
    include Authentication::CurrentBookManager
    include NotificationsManager
    include ApiKeyAuthenticatable

    respond_to :json
    protect_from_forgery with: :null_session

    prepend_before_action :set_current_user
    before_action :authenticate_with_api_key! # , only: [:index]
    before_action :set_default_response_format

    before_action :check_current_user_locked!
    before_action :authenticate_api!, except: [ :test_exception ]

    # Call this API endpoint to test that you have the correct
    # headers set.
    # @return 200 if successful
    def test
      render json: { message: 'Success!' }, status: :ok
    end

    # Use to test that exception are rendered properly.
    def test_exception
      raise 'boom'
    end

    def signup_enabled?
      Rails.application.config.signup_enabled
    end

    protected

    def set_default_response_format
      request.format = :json unless params[:format]
    end

    def deserialize_bool_param param_name
      ActiveRecord::Type::Boolean.new.deserialize(params[param_name]) || false
    end
  end
end
# rubocop:enable Rails/ApplicationController
