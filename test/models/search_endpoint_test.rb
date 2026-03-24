# frozen_string_literal: true

# == Schema Information
#
# Table name: search_endpoints
#
#  id                    :bigint           not null, primary key
#  api_method            :string(255)
#  archived              :boolean          default(FALSE)
#  basic_auth_credential :string(4000)
#  custom_headers        :string(6000)
#  endpoint_url          :string(500)
#  mapper_code           :text(65535)
#  name                  :string(255)
#  options               :json
#  proxy_requests        :boolean          default(FALSE)
#  requests_per_minute   :integer          default(0)
#  search_engine         :string(50)
#  test_query            :text(65535)
#  created_at            :datetime         not null
#  updated_at            :datetime         not null
#  owner_id              :integer
#
# Indexes
#
#  index_search_endpoints_on_owner_id_and_id  (owner_id,id)
#
require 'test_helper'
require 'support/shared_examples/custom_headers_validatable_examples'
require 'support/shared_examples/json_options_validatable_examples'

class SearchEndpointTest < ActiveSupport::TestCase
  include CustomHeadersValidatableExamples
  include JsonOptionsValidatableExamples

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

  # Helper method for CustomHeadersValidatable shared examples
  def create_record_with_custom_headers custom_headers
    SearchEndpoint.new(
      name:           'Test Endpoint',
      endpoint_url:   'http://test.example.com',
      search_engine:  'solr',
      api_method:     'GET',
      custom_headers: custom_headers
    )
  end

  # Helper method for JsonOptionsValidatable shared examples
  def create_record_with_options options
    SearchEndpoint.new(
      name:          'Test',
      endpoint_url:  'http://test.com',
      search_engine: 'solr',
      api_method:    'GET',
      options:       options
    )
  end

  # SearchEndpoint-specific tests
  describe 'basic_auth_credential format validation' do
    it 'accepts username:password format' do
      endpoint = SearchEndpoint.new(
        name: 'Test', endpoint_url: 'http://test.com', search_engine: 'solr',
        api_method: 'GET', basic_auth_credential: 'user:pass', proxy_requests: true
      )
      assert_predicate endpoint, :valid?
    end

    it 'rejects value without colon' do
      endpoint = SearchEndpoint.new(
        name: 'Test', endpoint_url: 'http://test.com', search_engine: 'solr',
        api_method: 'GET', basic_auth_credential: 'no-colon-here', proxy_requests: true
      )
      assert_not endpoint.valid?
      assert_includes endpoint.errors[:basic_auth_credential], 'must be in username:password format'
    end

    it 'allows blank credential' do
      endpoint = SearchEndpoint.new(
        name: 'Test', endpoint_url: 'http://test.com', search_engine: 'solr',
        api_method: 'GET', basic_auth_credential: ''
      )
      assert_predicate endpoint, :valid?
    end
  end

  describe 'basic_auth_credential encryption' do
    it 'round-trips through save and reload' do
      endpoint = SearchEndpoint.create!(
        name:                  'Auth Endpoint',
        endpoint_url:          'http://test.example.com',
        search_engine:         'solr',
        api_method:            'GET',
        basic_auth_credential: 'user:pass',
        proxy_requests:        true
      )
      endpoint.reload
      assert_equal 'user:pass', endpoint.basic_auth_credential
    end
  end

  describe 'masked_basic_auth_credential' do
    it 'always masks password' do
      endpoint = SearchEndpoint.new(basic_auth_credential: 'bob:password')
      assert_equal 'bob:******', endpoint.masked_basic_auth_credential
    end

    it 'returns nil for blank credential' do
      endpoint = SearchEndpoint.new(basic_auth_credential: nil)
      assert_nil endpoint.masked_basic_auth_credential
    end
  end

  describe 'api_basic_auth_credential' do
    it 'always returns nil when require_proxy_with_basic_auth_credentials is true' do
      original = Rails.application.config.require_proxy_with_basic_auth_credentials
      Rails.application.config.require_proxy_with_basic_auth_credentials = true
      endpoint = SearchEndpoint.new(basic_auth_credential: 'bob:password')
      assert_nil endpoint.api_basic_auth_credential
    ensure
      Rails.application.config.require_proxy_with_basic_auth_credentials = original
    end

    it 'returns none nil for blank credential' do
      original = Rails.application.config.require_proxy_with_basic_auth_credentials
      Rails.application.config.require_proxy_with_basic_auth_credentials = false
      endpoint = SearchEndpoint.new(basic_auth_credential: 'bob:password')
      assert_equal 'bob:password', endpoint.api_basic_auth_credential
    ensure
      Rails.application.config.require_proxy_with_basic_auth_credentials = original
    end
  end

  describe 'proxy required with basic auth credentials' do
    it 'requires proxy_requests when require_proxy_with_basic_auth_credentials is true' do
      original = Rails.application.config.require_proxy_with_basic_auth_credentials
      Rails.application.config.require_proxy_with_basic_auth_credentials = true
      endpoint = SearchEndpoint.new(
        name:                  'Test',
        endpoint_url:          'http://test.example.com',
        search_engine:         'solr',
        api_method:            'GET',
        basic_auth_credential: 'bob:password',
        proxy_requests:        false
      )
      assert_not endpoint.valid?
      assert_includes endpoint.errors[:proxy_requests], 'must be enabled when basic auth credentials are present'
    ensure
      Rails.application.config.require_proxy_with_basic_auth_credentials = original
    end

    it 'allows non-proxy when require_proxy_with_basic_auth_credentials is false' do
      original = Rails.application.config.require_proxy_with_basic_auth_credentials
      Rails.application.config.require_proxy_with_basic_auth_credentials = false
      endpoint = SearchEndpoint.new(
        name:                  'Test',
        endpoint_url:          'http://test.example.com',
        search_engine:         'solr',
        api_method:            'GET',
        basic_auth_credential: 'bob:password',
        proxy_requests:        false
      )
      assert_predicate endpoint, :valid?
    ensure
      Rails.application.config.require_proxy_with_basic_auth_credentials = original
    end
  end

  describe 'custom_headers persistence' do
    it 'normalizes after saving and reloading' do
      endpoint = SearchEndpoint.create!(
        name:           'Test Endpoint',
        endpoint_url:   'http://test.example.com',
        search_engine:  'solr',
        api_method:     'GET',
        custom_headers: { 'X-Retry' => 3, 'X-Debug' => true }
      )
      endpoint.reload
      assert_equal '3', endpoint.custom_headers['X-Retry']
      assert_equal 'true', endpoint.custom_headers['X-Debug']
    end
  end
end
