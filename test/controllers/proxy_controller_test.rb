# frozen_string_literal: true

require 'test_helper'

class ProxyControllerTest < ActionDispatch::IntegrationTest
  cover 'ProxyController#validate_proxy_url!'

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

  test 'embedded query parameters are decoded once and outer parameters override them' do
    stub = stub_request(:get, 'https://example.com/search')
      .with(query: { 'q' => 'a=b & café', 'rows' => '10' })
      .to_return(body: '{}', headers: { 'Content-Type' => 'application/json' })
    get proxy_fetch_path, params: { url: 'https://example.com/search?q=a%3Db%20%26%20caf%C3%A9&rows=5', rows: 10 }
    assert_response :ok
    assert_requested stub
  end

  test 'proxy debug accepts standard boolean values' do
    stub_request(:get, 'https://example.com/search').to_return(body: '{}', headers: { 'Content-Type' => 'application/json' })
    original = HttpClientService.method(:new)
    test_instance = self
    %w[1 true 0 false].each do |value|
      constructor = lambda do |url, **options|
        test_instance.assert_equal ActiveRecord::Type::Boolean.new.deserialize(value), options[:debug]
        original.call(url, **options, debug: false)
      end
      HttpClientService.define_singleton_method(:new, &constructor)
      get proxy_fetch_path, params: { url: 'https://example.com/search', proxy_debug: value }
      assert_response :ok
    end
  ensure
    HttpClientService.define_singleton_method(:new, &original) if original
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
    stub_request(:get, 'http://solr.quepidapp.com:8983/solr/statedecoded/select').with(query: { 'q' => '', 'fl' => 'id,text', 'rows' => '10', 'start' => '0' }).to_return(body: '{}', headers: { 'Content-Type' => 'application/json' })
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

  describe 'error handling' do
    test 'handle a proxy error cleanly' do
      get proxy_fetch_url params: {
        url: 'https://broken.quepidapp.com:9999/',
      }
      assert_response :internal_server_error
      assert_not_nil response.parsed_body['proxy_error']
    end
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

    test 'blocks the unspecified address, which reaches localhost' do
      get proxy_fetch_url params: { url: 'http://0.0.0.0:3000/healthcheck' }
      assert_response :bad_request
      assert_equal 'Proxy URL resolves to a disallowed address', response.parsed_body['proxy_error']
    end

    test 'blocks carrier-grade NAT 100.64.0.0/10 addresses' do
      get proxy_fetch_url params: { url: 'http://100.64.0.1/' }
      assert_response :bad_request
    end

    test 'blocks IPv6 unique-local addresses' do
      get proxy_fetch_url params: { url: 'http://[fc00::1]/' }
      assert_response :bad_request
      assert_equal 'Proxy URL resolves to a disallowed address', response.parsed_body['proxy_error']
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

  describe 'PROXY_ALLOWED_NETWORKS' do
    test 'allows a private address inside a listed network' do
      stub = stub_request(:get, 'http://10.0.5.20:8983/solr/select?q=*:*').to_return(body: '{}', headers: { 'Content-Type' => 'application/json' })

      with_proxy_allowed_networks('10.0.5.0/24') do
        get proxy_fetch_url params: { url: 'http://10.0.5.20:8983/solr/select', q: '*:*' }
      end

      assert_response :success
      assert_requested stub
    end

    test 'allows a single listed IP' do
      stub = stub_request(:get, 'http://127.0.0.1:8983/solr/select').to_return(body: '{}', headers: { 'Content-Type' => 'application/json' })

      with_proxy_allowed_networks('127.0.0.1') do
        get proxy_fetch_url params: { url: 'http://127.0.0.1:8983/solr/select' }
      end

      assert_response :success
      assert_requested stub
    end

    test 'still blocks a private address outside the listed networks' do
      with_proxy_allowed_networks('10.0.5.0/24') do
        get proxy_fetch_url params: { url: 'http://10.0.6.1/' }
      end

      assert_response :bad_request
      assert_equal 'Proxy URL resolves to a disallowed address', response.parsed_body['proxy_error']
    end

    test 'still blocks the cloud metadata endpoint when only RFC1918 is listed' do
      with_proxy_allowed_networks('10.0.0.0/8', '172.16.0.0/12', '192.168.0.0/16') do
        get proxy_fetch_url params: { url: 'http://169.254.169.254/latest/meta-data/' }
      end

      assert_response :bad_request
    end

    test 'matches a hostname by its resolved IPv4-mapped IPv6 address' do
      stub = stub_request(:get, 'http://solr.internal/solr/select').to_return(body: '{}', headers: { 'Content-Type' => 'application/json' })

      resolving('solr.internal', '::ffff:10.0.5.20') do
        with_proxy_allowed_networks('10.0.5.0/24') do
          get proxy_fetch_url params: { url: 'http://solr.internal/solr/select' }
        end
      end

      assert_response :success
      assert_requested stub
    end

    test 'blocks a hostname when any resolved address is outside the listed networks' do
      resolving('solr.internal', '10.0.5.20', '127.0.0.1') do
        with_proxy_allowed_networks('10.0.5.0/24') do
          get proxy_fetch_url params: { url: 'http://solr.internal/solr/select' }
        end
      end

      assert_response :bad_request
    end
  end

  describe 'PROXY_ALLOWED_HOSTS' do
    test 'allows a listed hostname that resolves to a private address' do
      stub = stub_request(:get, 'http://search.internal:9200/_search').to_return(body: '{}', headers: { 'Content-Type' => 'application/json' })

      resolving('search.internal', '172.18.0.5') do
        with_proxy_allowed_hosts('search.internal') do
          get proxy_fetch_url params: { url: 'http://search.internal:9200/_search' }
        end
      end

      assert_response :success
      assert_requested stub
    end

    test 'still blocks an unlisted hostname that resolves to the same private address' do
      resolving('other.internal', '172.18.0.5') do
        with_proxy_allowed_hosts('search.internal') do
          get proxy_fetch_url params: { url: 'http://other.internal:9200/_search' }
        end
      end

      assert_response :bad_request
    end

    test 'matches hostnames case-insensitively and ignores a trailing dot' do
      stub = stub_request(:get, /search\.internal/i).to_return(body: '{}', headers: { 'Content-Type' => 'application/json' })

      resolving('SEARCH.Internal.', '10.1.2.3') do
        with_proxy_allowed_hosts('search.internal') do
          get proxy_fetch_url params: { url: 'http://SEARCH.Internal./_search' }
        end
      end

      assert_response :success
      assert_requested stub
    end

    test 'still blocks a listed hostname that resolves to link-local addresses' do
      [ '169.254.169.254', 'fe80::1' ].each do |ip|
        resolving('search.internal', ip) do
          with_proxy_allowed_hosts('search.internal') do
            get proxy_fetch_url params: { url: 'http://search.internal/_search' }
          end
        end

        assert_response :bad_request, "expected #{ip} to stay blocked"
      end
    end

    test 'still blocks a listed hostname when any resolved address is link-local' do
      resolving('search.internal', '10.1.2.3', '169.254.169.254') do
        with_proxy_allowed_hosts('search.internal') do
          get proxy_fetch_url params: { url: 'http://search.internal/_search' }
        end
      end

      assert_response :bad_request
    end
  end

  describe 'admin-managed allowlist entries' do
    def stored_network value
      ProxyAllowlistEntry.create!(kind: ProxyAllowlistEntry::NETWORK, value: value)
    end

    def stored_host value
      ProxyAllowlistEntry.create!(kind: ProxyAllowlistEntry::HOST, value: value)
    end

    def stub_ok url
      stub_request(:get, url).to_return(body: '{}', headers: { 'Content-Type' => 'application/json' })
    end

    test 'are ignored, without querying them, when the flag is off' do
      stored_network('10.0.5.0/24')
      queries = []
      callback = ->(*, payload) { queries << payload[:sql] if payload[:sql].include?('proxy_allowlist_entries') }

      with_proxy_allowlist_admin_managed(false) do
        ActiveSupport::Notifications.subscribed(callback, 'sql.active_record') do
          get proxy_fetch_url params: { url: 'http://10.0.5.20/' }
        end
      end

      assert_response :bad_request
      assert_equal 'Proxy URL resolves to a disallowed address', response.parsed_body['proxy_error']
      assert_empty queries
    end

    test 'a stored network allows an address inside it when the flag is on' do
      stored_network('10.0.5.0/24')
      stub = stub_ok('http://10.0.5.20/')

      with_proxy_allowlist_admin_managed(true) do
        get proxy_fetch_url params: { url: 'http://10.0.5.20/' }
      end

      assert_response :success
      assert_requested stub
    end

    test 'a stored host resolving to a private address is allowed' do
      stored_host('search.internal')
      stub = stub_ok('http://search.internal/_search')

      resolving('search.internal', '10.1.2.3') do
        with_proxy_allowlist_admin_managed(true) do
          get proxy_fetch_url params: { url: 'http://search.internal/_search' }
        end
      end

      assert_response :success
      assert_requested stub
    end

    test 'a stored host resolving to loopback, unspecified or link-local is blocked' do
      stored_host('search.internal')

      [ '127.0.0.1', '::1', '0.0.0.0', '::', '169.254.169.254', 'fe80::1' ].each do |ip|
        resolving('search.internal', ip) do
          with_proxy_allowlist_admin_managed(true) do
            get proxy_fetch_url params: { url: 'http://search.internal/_search' }
          end
        end

        assert_response :bad_request, "expected #{ip} to stay blocked"
      end
    end

    test 'stored network rows covering loopback, inserted directly, still cannot reach it' do
      now = Time.current
      ProxyAllowlistEntry.insert_all!(%w[127.0.0.0/8 0.0.0.0/8].map { |value| { kind: ProxyAllowlistEntry::NETWORK, value: value, created_at: now, updated_at: now } })

      with_proxy_allowlist_admin_managed(true) do
        [ 'http://127.0.0.1/', 'http://0.0.0.0:3000/' ].each do |url|
          get proxy_fetch_url params: { url: url }
          assert_response :bad_request, url
        end
      end
    end

    test 'an address allowed by ENV stays allowed after the stored entry is deleted' do
      entry = stored_network('10.0.5.0/24')
      stub = stub_ok('http://10.0.5.20/')

      with_proxy_allowlist_admin_managed(true) do
        with_proxy_allowed_networks('10.0.5.0/24') do
          entry.destroy!
          get proxy_fetch_url params: { url: 'http://10.0.5.20/' }
        end
      end

      assert_response :success
      assert_requested stub
    end

    test 'editing a stored network takes effect on the next request' do
      entry = stored_network('10.0.5.0/24')
      stub = stub_ok('http://10.0.6.20/')

      with_proxy_allowlist_admin_managed(true) do
        entry.update!(value: '10.0.6.0/24')

        get proxy_fetch_url params: { url: 'http://10.0.6.20/' }
        assert_response :success

        get proxy_fetch_url params: { url: 'http://10.0.5.20/' }
        assert_response :bad_request
      end

      assert_requested stub
    end

    test 'an ENV host resolving to loopback is still allowed with the flag on' do
      stub = stub_ok('http://search.internal/_search')

      resolving('search.internal', '127.0.0.1') do
        with_proxy_allowlist_admin_managed(true) do
          with_proxy_allowed_hosts('search.internal') do
            get proxy_fetch_url params: { url: 'http://search.internal/_search' }
          end
        end
      end

      assert_response :success
      assert_requested stub
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

  # Makes `host` resolve to `ips` for the duration of the block.
  def resolving host, *ips
    original = Addrinfo.method(:getaddrinfo)
    Addrinfo.define_singleton_method(:getaddrinfo) do |name, *args|
      host == name ? ips.map { |ip| Addrinfo.ip(ip) } : original.call(name, *args)
    end
    yield
  ensure
    Addrinfo.define_singleton_method(:getaddrinfo, &original)
  end

  # rubocop:disable-next Metrics/MethodLength
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
end
