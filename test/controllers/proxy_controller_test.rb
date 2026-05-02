# frozen_string_literal: true

require 'test_helper'

class ProxyControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:joey) }

  # Hostnames used in this file's stubs that don't resolve via real DNS. The proxy's
  # SSRF check resolves the host before fetching, so we shim Addrinfo to return
  # a public-routable IP (TEST-NET-2, 198.51.100.0/24) for these.
  PROXY_TEST_HOSTS = %w[
    solr.quepidapp.com example.com broken.quepidapp.com
  ].freeze

  setup do
    login_user_for_integration_test user

    @original_getaddrinfo = Addrinfo.method(:getaddrinfo)
    original = @original_getaddrinfo
    Addrinfo.define_singleton_method(:getaddrinfo) do |host, *args|
      if PROXY_TEST_HOSTS.include?(host)
        [ Addrinfo.ip('198.51.100.10') ]
      else
        original.call(host, *args)
      end
    end

    register_proxy_webmock_stubs
  end

  teardown do
    if @original_getaddrinfo
      original = @original_getaddrinfo
      Addrinfo.define_singleton_method(:getaddrinfo, &original)
    end
  end

  test 'should require a url query parameter' do
    get proxy_fetch_path
    assert_response :bad_request

    post proxy_fetch_path
    assert_response :bad_request
  end

  test 'should be able to handle a get' do
    get proxy_fetch_url params: {
      url: 'http://solr.quepidapp.com:8983/solr/statedecoded/select', fl: 'id,text', q: 'legal', rows: 10, start: 0
    }
    assert_response :success
  end

  test 'should be able to handle a get with a trailing ?q=legal parameter' do
    get proxy_fetch_url params: {
      url: 'http://solr.quepidapp.com:8983/solr/statedecoded/select?q=legal', fl: 'id,text', rows: 10, start: 0
    }
    assert_response :success
  end

  test 'should be able to handle a get with a trailing ? parameter and nothing else' do
    get proxy_fetch_url params: {
      url: 'http://solr.quepidapp.com:8983/solr/statedecoded/select?', fl: 'id,text', q: 'legal', rows: 10, start: 0
    }
    assert_response :success
  end

  test 'should be able to handle a get with a ?q= and no value' do
    get proxy_fetch_url params: {
      url: 'http://solr.quepidapp.com:8983/solr/statedecoded/select?q=', fl: 'id,text', rows: 10, start: 0
    }
    assert_response :success
  end

  test 'should be able to handle a get with a ? character in the query' do
    get proxy_fetch_url params: {
      url: 'http://solr.quepidapp.com:8983/solr/statedecoded/select?q=tiger?', fl: 'id,text', rows: 10, start: 0
    }
    assert_response :success
  end

  test 'should be able to handle a get with multiple ? character in the query' do
    get proxy_fetch_url params: {
      url: 'http://solr.quepidapp.com:8983/solr/statedecoded/select?q=I like ? marks, do you like ? marks?', fl: 'id,text', rows: 10, start: 0
    }
    assert_response :success
  end

  test 'should be able to handle a get with spaces in the query' do
    get proxy_fetch_url params: {
      url: 'http://solr.quepidapp.com:8983/solr/statedecoded/select?q=can I own a tiger', fl: 'id,text', rows: 10, start: 0
    }
    assert_response :success
  end

  test 'should be able to handle a get with non ASCII characters' do
    get proxy_fetch_url params: {
      url: 'http://solr.quepidapp.com:8983/solr/statedecoded/select?q=At dusk, the café transformed into an impromptu stage', fl: 'id,text', rows: 10, start: 0
    }
    assert_response :success
  end

  test 'should be able to handle a post' do
    json_data = { query: 'trek', key2: 'value2' }.to_json

    post '/proxy/fetch?url=http://solr.quepidapp.com:8983/solr/statedecoded/select', params:  json_data,
                                                                                     headers: { 'Content-Type' => 'application/json' }
    assert_response :success
  end

  test 'should forward Authorization and custom headers' do
    json_data = { query: 'trek' }.to_json

    post '/proxy/fetch?url=http://solr.quepidapp.com:8983/solr/statedecoded/with_auth', params:  json_data,
                                                                                        headers: { 'Content-Type' => 'application/json', 'Authorization' => 'Basic dGVzdDp0ZXN0', 'X-Custom-Header' => 'test-value' }

    assert_response :success
  end

  test 'should look up search endpoint credentials by search_endpoint_id' do
    endpoint = SearchEndpoint.create!(
      name:                  'Auth Endpoint',
      endpoint_url:          'http://solr.quepidapp.com:8983/solr/statedecoded/with_endpoint_auth',
      search_engine:         'solr',
      api_method:            'GET',
      basic_auth_credential: 'user:pass',
      proxy_requests:        true,
      owner:                 user
    )

    get proxy_fetch_url params: {
      url:                'http://solr.quepidapp.com:8983/solr/statedecoded/with_endpoint_auth',
      search_endpoint_id: endpoint.id,
      q:                  'test',
    }
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
      url: 'https://broken.quepidapp.com:9999/',
    }
    assert_response :internal_server_error
    assert_not_nil response.parsed_body['proxy_error']
  end

  describe 'authentication' do
    test 'rejects an anonymous request' do
      reset! # drop the logged-in session set up in `setup`
      get proxy_fetch_url params: {
        url: 'http://solr.quepidapp.com:8983/solr/statedecoded/select', q: 'legal'
      }
      assert_response :redirect
      assert_redirected_to new_session_path
    end
  end

  describe 'SSRF protection' do
    test 'blocks loopback by IP literal' do
      get proxy_fetch_url params: { url: 'http://127.0.0.1/anything' }
      assert_response :bad_request
      assert_not_nil response.parsed_body['proxy_error']
    end

    test 'blocks loopback by hostname' do
      get proxy_fetch_url params: { url: 'http://localhost/anything' }
      assert_response :bad_request
    end

    test 'blocks the cloud metadata endpoint' do
      get proxy_fetch_url params: { url: 'http://169.254.169.254/latest/meta-data/' }
      assert_response :bad_request
    end

    test 'blocks RFC1918 10.0.0.0/8 addresses' do
      get proxy_fetch_url params: { url: 'http://10.0.0.5/' }
      assert_response :bad_request
    end

    test 'blocks RFC1918 172.16.0.0/12 addresses' do
      get proxy_fetch_url params: { url: 'http://172.16.5.5/' }
      assert_response :bad_request
    end

    test 'blocks RFC1918 192.168.0.0/16 addresses' do
      get proxy_fetch_url params: { url: 'http://192.168.1.1/' }
      assert_response :bad_request
    end

    test 'blocks IPv6 unique-local addresses' do
      get proxy_fetch_url params: { url: 'http://[fc00::1]/' }
      assert_response :bad_request
    end

    test 'blocks a public hostname that resolves to a private IP' do
      original = Addrinfo.method(:getaddrinfo)
      Addrinfo.define_singleton_method(:getaddrinfo) do |host, *args|
        'evil.example.com' == host ? [ Addrinfo.ip('127.0.0.1') ] : original.call(host, *args)
      end

      get proxy_fetch_url params: { url: 'http://evil.example.com/' }
      assert_response :bad_request
    ensure
      Addrinfo.define_singleton_method(:getaddrinfo, &original) if original
    end

    test 'rejects non-http(s) schemes' do
      get proxy_fetch_url params: { url: 'file:///etc/passwd' }
      assert_response :bad_request
    end

    test 'rejects malformed URLs' do
      get proxy_fetch_url params: { url: 'not a url' }
      assert_response :bad_request
    end

    test 'allows a normal public URL' do
      get proxy_fetch_url params: {
        url: 'http://solr.quepidapp.com:8983/solr/statedecoded/select', fl: 'id,text', q: 'legal', rows: 10, start: 0
      }
      assert_response :success
    end
  end

  describe 'search_endpoint_id authorization' do
    test 'does NOT attach credentials when the endpoint belongs to another user' do
      foreign_endpoint = search_endpoints(:foreign_with_credentials)

      stub_request(:get, 'http://solr.quepidapp.com:8983/solr/statedecoded/with_endpoint_auth?q=test')
        .with { |req| !req.headers.key?('Authorization') }
        .to_return(status: 200, body: '{}', headers: { 'Content-Type' => 'application/json' })

      get proxy_fetch_url params: {
        url:                'http://solr.quepidapp.com:8983/solr/statedecoded/with_endpoint_auth',
        search_endpoint_id: foreign_endpoint.id,
        q:                  'test',
      }
      assert_response :success
      assert_not_requested(
        :get,
        'http://solr.quepidapp.com:8983/solr/statedecoded/with_endpoint_auth?q=test',
        headers: { 'Authorization' => 'Basic dXNlcjpwYXNz' }
      )
    end
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
        url: 'http://solr.quepidapp.com:8983/solr/statedecoded/select?', fl: 'id,text', q: 'legal', rows: 10, start: 0, proxy_debug: true
      }
      assert_response :success
      captured_output = @output.string
      assert_includes captured_output, 'For the purpose of this chapter'
    end

    test 'logging of http is disabled by default' do
      get proxy_fetch_url params: {
        url: 'http://solr.quepidapp.com:8983/solr/statedecoded/select?', fl: 'id,text', q: 'legal', rows: 10, start: 0
      }
      assert_response :success
      captured_output = @output.string
      assert_not_includes captured_output, 'For the purpose of this chapter'
    end
  end

  private

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  def register_proxy_webmock_stubs
    body = File.read(Rails.root.join('test/fixtures/files/solr_statedecoded_response.json'))

    faraday_headers = {
      'Accept'          => '*/*',
      'Accept-Encoding' => 'gzip;q=1.0,deflate;q=0.6,identity;q=0.3',
      'Content-Type'    => 'application/json',
      'Https'           => 'off',
      'User-Agent'      => /Faraday/,
    }

    base = 'http://solr.quepidapp.com:8983/solr/statedecoded/select'

    stub_request(:get, "#{base}?fl=id,text&q=tiger?&rows=10&start=0")
      .with(headers: faraday_headers).to_return(status: 200, body: body)

    stub_request(:get, "#{base}?fl=id,text&q=can%20I%20own%20a%20tiger&rows=10&start=0")
      .with(headers: faraday_headers).to_return(status: 200, body: body)

    stub_request(:get, "#{base}?fl=id,text&q=I%20like%20?%20marks,%20do%20you%20like%20?%20marks?&rows=10&start=0")
      .with(headers: faraday_headers).to_return(status: 200, body: body)

    stub_request(:get, "#{base}?fl=id,text&q&rows=10&start=0")
      .with(headers: faraday_headers).to_return(status: 200, body: body)

    stub_request(:get, "#{base}?fl=id,text&q=legal&rows=10&start=0")
      .with(headers: faraday_headers).to_return(status: 200, body: body)

    # Non-ASCII (café) handling.
    stub_request(:get, "#{base}?fl=id,text&q=At%20dusk,%20the%20caf%C3%A9%20transformed%20into%20an%20impromptu%20stage&rows=10&start=0")
      .with(headers: faraday_headers).to_return(status: 200, body: '')

    stub_request(:post, base)
      .with(body: '{"query":"trek","key2":"value2"}', headers: faraday_headers)
      .to_return(status: 200, body: body)

    # Verifies that Authorization and custom headers are forwarded.
    stub_request(:post, 'http://solr.quepidapp.com:8983/solr/statedecoded/with_auth')
      .with(
        body:    '{"query":"trek"}',
        headers: {
          'Authorization'   => 'Basic dGVzdDp0ZXN0', # Base64 of 'test:test'
          'X-Custom-Header' => 'test-value',
          'Content-Type'    => 'application/json',
        }
      )
      .to_return(status: 200, body: body)

    # Verifies that the proxy looks up search endpoint credentials by ID.
    stub_request(:get, 'http://solr.quepidapp.com:8983/solr/statedecoded/with_endpoint_auth?q=test')
      .with(
        headers: {
          'Authorization' => 'Basic dXNlcjpwYXNz', # Base64 of 'user:pass'
          'Content-Type'  => 'application/json',
        }
      )
      .to_return(status: 200, body: body)

    # Demonstrates following a 302 redirect.
    stub_request(:get, 'https://example.com/old-url')
      .to_return(status: 302, headers: { 'Location' => 'https://example.com/new-location' })
    stub_request(:get, 'https://example.com/new-location')
      .to_return(status: 200, body: body)

    # Demonstrates server error. Uses a public-resolving host so the SSRF
    # validator doesn't block before the connection attempt.
    stub_request(:get, 'https://broken.quepidapp.com:9999/')
      .to_raise(Faraday::ConnectionFailed.new('Failed to connect'))
  end
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/AbcSize
end
