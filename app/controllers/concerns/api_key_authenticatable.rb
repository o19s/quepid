# frozen_string_literal: true

# Inspired by https://keygen.sh/blog/how-to-implement-api-key-authentication-in-rails-without-devise/
module ApiKeyAuthenticatable
  extend ActiveSupport::Concern

  include ActionController::HttpAuthentication::Token::ControllerMethods

  attr_reader :current_api_key
  attr_reader :current_user

  # Use this to raise an error and automatically respond with a 401 HTTP status
  # code when API key authentication fails
  def authenticate_with_api_key!
    if @current_user.nil? # we may already have a current_user from cookies.
      @current_user = authenticate_or_request_with_http_token(&method(:authenticator))
    end
  end

  # Use this for optional API key authentication
  def authenticate_with_api_key
    if @current_user.nil? # we may already have a current_user from cookies.
      @current_bearer = authenticate_with_http_token(&method(:authenticator))
    end
  end

  private

  attr_writer :current_api_key, :current_bearer

  def authenticator http_token, _options
    @current_api_key = ApiKey.find_by token: http_token

    current_api_key&.bearer
  end
end
