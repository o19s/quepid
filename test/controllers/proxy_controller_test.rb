# frozen_string_literal: true

require 'test_helper'

# rubocop:disable Layout/LineLength
class ProxyControllerTest < ActionDispatch::IntegrationTest
  # See webmock.rb for the corresponding mocks.
  #
  test 'should require a url query parameter' do
    get proxy_fetch_path
    assert_response :bad_request

    post proxy_fetch_path
    assert_response :bad_request
  end

  test 'should be able to handle a get' do
    get proxy_fetch_url params: {
      url: 'http://solr.quepid.com:8983/solr/statedecoded/select', fl: 'id,text', q: 'legal', rows: 10, start: 0
    }
    assert_response :success
  end

  test 'should be able to handle a get with a trailing ?q=legal parameter' do
    get proxy_fetch_url params: {
      url: 'http://solr.quepid.com:8983/solr/statedecoded/select?q=legal', fl: 'id,text', rows: 10, start: 0
    }
    assert_response :success
  end

  test 'should be able to handle a get with a trailing ? parameter and nothing else' do
    get proxy_fetch_url params: {
      url: 'http://solr.quepid.com:8983/solr/statedecoded/select?', fl: 'id,text', q: 'legal', rows: 10, start: 0
    }
    assert_response :success
  end

  test 'should be able to handle a get with a ? character in the query' do
    get proxy_fetch_url params: {
      url: 'http://solr.quepid.com:8983/solr/statedecoded/select?q=tiger?', fl: 'id,text', rows: 10, start: 0
    }
    assert_response :success
  end

  test 'should be able to handle a get with multiple ? character in the query' do
    get proxy_fetch_url params: {
      url: 'http://solr.quepid.com:8983/solr/statedecoded/select?q=I like ? marks, do you like ? marks?', fl: 'id,text', rows: 10, start: 0
    }
    assert_response :success
  end

  test 'should be able to handle a get with spaces in the query' do
    get proxy_fetch_url params: {
      url: 'http://solr.quepid.com:8983/solr/statedecoded/select?q=can I own a tiger', fl: 'id,text', rows: 10, start: 0
    }
    assert_response :success
  end

  test 'should be able to handle a get with non ASCII characters' do
    get proxy_fetch_url params: {
      url: 'http://solr.quepid.com:8983/solr/statedecoded/select?q=At dusk, the café transformed into an impromptu stage', fl: 'id,text', rows: 10, start: 0
    }
    assert_response :success
  end

  test 'should be able to handle a post' do
    json_data = { query: 'trek', key2: 'value2' }.to_json

    post '/proxy/fetch?url=http://solr.quepid.com:8983/solr/statedecoded/select', params:  json_data,
                                                                                  headers: { 'Content-Type' => 'application/json' }
    assert_response :success
  end

  describe 'should follow 302 redirects' do
    test 'on a get' do
      old_url = 'https://example.com/old-url'

      get proxy_fetch_url params: {
        url: old_url,
      }
      assert_response :success
    end
  end

  test 'handle a proxy error cleanly' do
    get proxy_fetch_url params: {
      url: 'https://localhost:9999/',
    }
    assert_response :internal_server_error
    assert_not_nil response.parsed_body['proxy_error']
  end

  describe 'logging of http requests by the proxy' do
    before do
      # Create a StringIO object to capture the output
      @output = StringIO.new
      $stdout = @output
    end

    after do
      # Reset $stdout to its original value
      $stdout = STDOUT
    end

    test 'logging of http is enabled' do
      get proxy_fetch_url params: {
        url: 'http://solr.quepid.com:8983/solr/statedecoded/select?', fl: 'id,text', q: 'legal', rows: 10, start: 0, proxy_debug: true
      }
      assert_response :success
      captured_output = @output.string
      assert_includes captured_output, 'For the purpose of this chapter'
    end

    test 'logging of http is disabled by default' do
      get proxy_fetch_url params: {
        url: 'http://solr.quepid.com:8983/solr/statedecoded/select?', fl: 'id,text', q: 'legal', rows: 10, start: 0
      }
      assert_response :success
      captured_output = @output.string
      assert_not_includes captured_output, 'For the purpose of this chapter'
    end
  end
end
# rubocop:enable Layout/LineLength
