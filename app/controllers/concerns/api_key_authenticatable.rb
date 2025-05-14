# frozen_string_literal: true

# Inspired by https://keygen.sh/blog/how-to-implement-api-key-authentication-in-rails-without-devise/
module ApiKeyAuthenticatable
  extend ActiveSupport::Concern

  include ActionController::HttpAuthentication::Token::ControllerMethods

  attr_reader :current_api_key, :current_user

  # both of the authentication_with_api_key methods need to work with our Devise based
  # approach of using a Session.  So only kick this is when we don't have a current user (i.e no session)
  # and we have an Authorization header being passed in.

  # Use this to raise an error and automatically respond with a 401 HTTP status
  # code when API key authentication fails
  def authenticate_with_api_key!
    @current_user = authenticate_or_request_with_http_token(&method(:authenticator)) if @current_user.nil? && !request.headers['Authorization'].nil?
  end

  # Use this for optional API key authentication
  def authenticate_with_api_key
    @current_user = authenticate_with_http_token(&method(:authenticator)) if @current_user.nil? && request.headers['Authorization'].nil?
  end

  private

  attr_writer :current_api_key, :current_user

  def authenticator http_token, _options
    @current_api_key = ApiKey.find_by token_digest: http_token

    current_api_key&.user
  end
end
