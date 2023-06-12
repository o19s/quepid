# frozen_string_literal: true

# == Schema Information
#
# Table name: api_keys
#
#  id          :bigint           not null, primary key
#  bearer_type :string(255)      not null
#  token       :string(255)      not null
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  bearer_id   :integer          not null
#
# Indexes
#
#  index_api_keys_on_bearer_id_and_bearer_type  (bearer_id,bearer_type)
#  index_api_keys_on_token                      (token) UNIQUE
#
# # Inspired by https://keygen.sh/blog/how-to-implement-api-key-authentication-in-rails-without-devise/
class ApiKey < ApplicationRecord
  belongs_to :bearer, polymorphic: true
end
