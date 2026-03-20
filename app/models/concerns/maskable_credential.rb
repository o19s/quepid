# frozen_string_literal: true

module MaskableCredential
  extend ActiveSupport::Concern

  MASKED_PASSWORD = '******'

  included do
    validate :validate_basic_auth_credential_format
  end

  # Returns the credential with password masked.
  # Used in HTML views and edit forms.
  def masked_basic_auth_credential
    return basic_auth_credential if basic_auth_credential.blank?

    username, _password = basic_auth_credential.split(':', 2)
    "#{username}:#{MASKED_PASSWORD}"
  end

  # Returns nil when proxy is required to prevent credentials from being sent to the browser.
  # Otherwise returns the full credential for direct browser connections.
  # Used in JSON API responses.
  def api_basic_auth_credential
    return nil if Rails.application.config.require_proxy_with_basic_auth_credentials && basic_auth_credential.present?

    basic_auth_credential
  end


  private

  def validate_basic_auth_credential_format
    return if basic_auth_credential.blank?

    errors.add(:basic_auth_credential, 'must be in username:password format') unless basic_auth_credential.include?(':')
  end
end
