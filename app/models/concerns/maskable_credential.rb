# frozen_string_literal: true

module MaskableCredential
  extend ActiveSupport::Concern

  MASKED_PASSWORD = '******'

  included do
    validate :validate_basic_auth_credential_format
  end

  # Returns the credential with password masked when SHOW_BASIC_AUTH_CREDENTIALS is false.
  # Used in HTML views and edit forms.
  def masked_basic_auth_credential
    return basic_auth_credential if basic_auth_credential.blank?
    return basic_auth_credential if Rails.application.config.show_basic_auth_credentials

    username, _password = basic_auth_credential.split(':', 2)
    "#{username}:#{MASKED_PASSWORD}"
  end

  # Returns nil when credentials are hidden, so the browser never receives the credential.
  # Used in JSON API responses.
  def api_basic_auth_credential
    return basic_auth_credential if basic_auth_credential.blank?
    return nil unless Rails.application.config.show_basic_auth_credentials

    basic_auth_credential
  end

  def basic_auth_credential_masked?
    !Rails.application.config.show_basic_auth_credentials && basic_auth_credential.present?
  end

  private

  def validate_basic_auth_credential_format
    return if basic_auth_credential.blank?

    errors.add(:basic_auth_credential, 'must be in username:password format') unless basic_auth_credential.include?(':')
  end
end
