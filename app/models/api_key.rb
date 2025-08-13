# frozen_string_literal: true

# <rails-lens:schema:begin>
# table = "api_keys"
# database_dialect = "MySQL"
# storage_engine = "InnoDB"
# character_set = "utf8mb4"
# collation = "utf8mb4_0900_ai_ci"
#
# columns = [
#   { name = "id", type = "integer", primary_key = true, nullable = false },
#   { name = "user_id", type = "integer", nullable = true },
#   { name = "token_digest", type = "string", nullable = false },
#   { name = "created_at", type = "datetime", nullable = false },
#   { name = "updated_at", type = "datetime", nullable = false }
# ]
#
# indexes = [
#   { name = "index_api_keys_on_token_digest", columns = ["token_digest"] },
#   { name = "index_api_keys_user_id", columns = ["user_id"] }
# ]
#
# == Notes
# - Missing foreign key constraint on 'user_id' referencing 'users'
# - Association 'user' should specify inverse_of
# <rails-lens:schema:end>
class ApiKey < ApplicationRecord
  HMAC_SECRET_KEY = Rails.application.secret_key_base
  belongs_to :user

  before_create :generate_token_hmac_digest

  # Virtual attribute for raw token value, allowing us to respond with the

  # API key's non-hashed token value. but only directly after creation.

  attr_accessor :token

  def self.authenticate_by_token! token
    digest = OpenSSL::HMAC.hexdigest 'SHA256', HMAC_SECRET_KEY, token

    find_by! token_digest: digest
  end

  def self.authenticate_by_token token
    authenticate_by_token! token
  rescue ActiveRecord::RecordNotFound
    nil
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
    raise ActiveRecord::RecordInvalid, 'token is required' if

      token.blank?

    digest = OpenSSL::HMAC.hexdigest 'SHA256', HMAC_SECRET_KEY, token

    self.token_digest = digest
  end
end
