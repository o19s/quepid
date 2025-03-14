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
# Indexes
#
#  index_search_endpoints_on_owner_id_and_id  (owner_id,id)
#
require 'test_helper'

class SearchEndpointTest < ActiveSupport::TestCase
  describe 'full name' do
    it 'requires a search_engine to be defined' do
      endpoint = SearchEndpoint.new endpoint_url: 'http://something'
      assert_not endpoint.valid?
      assert_includes endpoint.errors[:search_engine], "can't be blank"

      assert_raises(StandardError) do
        endpoint.fullname
      end

      endpoint.search_engine = 'solr'
      assert_equal 'Solr http://something', endpoint.fullname
    end
  end

  describe 'proxy' do
    let(:jsonp_endpoint) { search_endpoints(:for_shared_team_case) }
    it 'prevents JSONP being used' do
      assert_not jsonp_endpoint.update(proxy_requests: true)
    end
  end

  describe 'options' do
    let(:search_endpoint) { search_endpoints(:for_case_queries_case) }
    it 'handles options from fixture file' do
      assert_equal({ 'corpusId'=> 12_345 }, search_endpoint.options)
    end
  end
end
