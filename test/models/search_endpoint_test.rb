# frozen_string_literal: true

# == Schema Information
#
# Table name: search_endpoints
#
#  id                    :bigint           not null, primary key
#  api_method            :string(255)
#  archived              :boolean          default(FALSE)
#  basic_auth_credential :string(255)      default("0")
#  custom_headers        :string(1000)
#  endpoint_url          :string(500)
#  mapper_code           :text(65535)
#  name                  :string(255)
#  search_engine         :string(50)
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  owner_id              :integer
#
require 'test_helper'

class SearchEndpointTest < ActiveSupport::TestCase
  # test "the truth" do
  #   assert true
  # end
end
