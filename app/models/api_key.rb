# frozen_string_literal: true

# == Schema Information
#
# Table name: api_keys
#
#  id          :bigint           not null, primary key
#  bearer_type :string(255)
#  token       :string(255)
#  created_at  :datetime         not null
#  updated_at  :datetime         not null
#  bearer_id   :integer
#
# Indexes
#
#  index_api_keys_on_token  (token) UNIQUE
#
class ApiKey < ApplicationRecord
  belongs_to :bearer, polymorphic: true
end
