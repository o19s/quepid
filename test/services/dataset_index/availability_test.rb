# frozen_string_literal: true

require 'test_helper'

module DatasetIndex
  class AvailabilityTest < ActiveSupport::TestCase
    let(:user) { users(:random) }

    def endpoint url, **extra
      SearchEndpoint.new(owner: user, name: 'My es', search_engine: 'es', api_method: 'POST', endpoint_url: url, **extra)
    end

    def basic credentials
      "Basic #{Base64.strict_encode64(credentials)}"
    end

    test 'the browser probe sends the endpoint credential and custom headers' do
      es = endpoint('http://es.example.com:9200/movies/_search', basic_auth_credential: 'elastic:secret', custom_headers: { 'X-Team' => 'search' })
      probe = Availability.browser_probe(es)

      assert_equal({ origin: 'http://es.example.com:9200', engine: 'es', path: '/movies/_search',
                     headers: { 'X-Team' => 'search', 'Authorization' => basic('elastic:secret') } }, probe)
    end

    test 'the browser probe takes the credentials from the URL when the endpoint has none, and leaves them out of the origin' do
      probe = Availability.browser_probe(endpoint('http://elastic:p%40ss@es.example.com:9200/movies/_search'))

      assert_equal 'http://es.example.com:9200', probe[:origin]
      assert_equal basic('elastic:p@ss'), probe[:headers]['Authorization']
    end

    test "the browser probe prefers the endpoint's credential to the URL's" do
      probe = Availability.browser_probe(endpoint('http://old:pw@es.example.com:9200/movies/_search', basic_auth_credential: 'elastic:secret'))

      assert_equal basic('elastic:secret'), probe[:headers]['Authorization']
    end

    test 'the browser probe sends no Authorization without credentials' do
      probe = Availability.browser_probe(endpoint('http://es.example.com:9200/movies/_search'))

      assert_not probe[:headers].key?('Authorization')
    end
  end
end
