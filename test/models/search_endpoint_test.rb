# frozen_string_literal: true

# == Schema Information
#
# Table name: search_endpoints
#
#  id                    :bigint           not null, primary key
#  api_method            :string(255)
#  archived              :boolean          default(FALSE)
#  basic_auth_credential :string(255)
#  custom_headers        :string(6000)
#  endpoint_url          :string(500)
#  mapper_code           :text(65535)
#  name                  :string(255)
#  options               :json
#  proxy_requests        :boolean          default(FALSE)
#  search_engine         :string(50)
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  owner_id              :integer
#
require 'test_helper'

class SearchEndpointTest < ActiveSupport::TestCase
  describe 'basic auth credentials' do
    it 'prevents invalid characters ' do
      endpoint = SearchEndpoint.new(basic_auth_credential: 'bob:test%123')
      assert_not endpoint.valid?
      assert_includes endpoint.errors[:basic_auth_credential], 'contains invalid characters: %'
    end
  end
end
