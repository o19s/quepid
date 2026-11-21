# frozen_string_literal: true

# == Schema Information
#
# Table name: api_keys
#
#  id           :bigint           not null, primary key
#  token_digest :string(255)      not null
#  created_at   :datetime         not null
#  updated_at   :datetime         not null
#  user_id      :integer
#
# Indexes
#
#  index_api_keys_on_token_digest  (token_digest)
#  index_api_keys_user_id          (user_id)
#
class ApiKey < ApplicationRecord
  HMAC_SECRET_KEY = Rails.application.secret_key_base
  belongs_to :user

  validates :token, presence: true, on: :create

  before_create :generate_token_hmac_digest

  # Virtual attribute for raw token value, allowing us to respond with the

  # API key's non-hashed token value. but only directly after creation.

  attr_accessor :token

  def self.digest_for token
    OpenSSL::HMAC.hexdigest 'SHA256', HMAC_SECRET_KEY, token
  end

  def self.authenticate_by_token! token
    find_by! token_digest: digest_for(token)
  end

  # Add virtual token attribute to serializable attributes, and exclude

  # the token's HMAC digest

  def serializable_hash options = nil
    h = super(options.merge(except: 'token_digest'))

    h.merge! 'token' => token if token.present?

    h
  end

  private

  def generate_token_hmac_digest
    self.token_digest = self.class.digest_for(token)
  end
end
