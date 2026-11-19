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
  # Lets people, and secret scanners, recognise a Quepid token.
  TOKEN_PREFIX = 'qp_'

  belongs_to :user

  validates :token, presence: true, on: :create

  before_create :generate_token_hmac_digest

  # Virtual attribute for raw token value, allowing us to respond with the

  # API key's non-hashed token value. but only directly after creation.

  attr_accessor :token

  def self.generate_token
    "#{TOKEN_PREFIX}#{SecureRandom.hex}"
  end

  def self.digest token
    OpenSSL::HMAC.hexdigest 'SHA256', HMAC_SECRET_KEY, token
  end

  # We only store the HMAC digest, so look a raw token up by its digest, and then confirm the match
  # with a constant time comparison rather than trusting the database's string comparison.
  def self.authenticate_by_token token
    token_digest = digest(token)
    api_key = find_by token_digest: token_digest

    api_key if api_key && ActiveSupport::SecurityUtils.secure_compare(api_key.token_digest, token_digest)
  end

  def self.authenticate_by_token! token
    authenticate_by_token(token) || raise(ActiveRecord::RecordNotFound.new("Couldn't find ApiKey", name))
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
    self.token_digest = self.class.digest(token)
  end
end
