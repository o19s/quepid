# frozen_string_literal: true

require 'test_helper'

class HttpClientServiceTest < ActiveSupport::TestCase
  test 'parses url_without_path correctly for standard URL' do
    client = HttpClientService.new('https://example.com/path/to/resource')
    assert_equal 'https://example.com', client.url_without_path
  end

  test 'parses url_without_path with custom port' do
    client = HttpClientService.new('http://example.com:8080/search')
    assert_equal 'http://example.com:8080', client.url_without_path
  end

  test 'detects credentials in URL' do
    client_with_creds = HttpClientService.new('http://user:pass@example.com/search')
    client_without_creds = HttpClientService.new('http://example.com/search')

    assert_predicate client_with_creds, :credentials?
    assert_not client_without_creds.credentials?
  end

  test 'handles non-ASCII characters in URL' do
    client = HttpClientService.new('https://example.com/search?q=café')
    assert_equal 'https://example.com', client.url_without_path
    assert_equal 'café', client.uri.query_values['q']
  end

  test 'performs GET request successfully' do
    stub_request(:get, 'https://example.com/search')
      .with(query: { 'q' => 'test' })
      .to_return(status: 200, body: '{"results": []}')

    client = HttpClientService.new('https://example.com/search?q=test')
    response = client.get

    assert_predicate response, :success?
    assert_equal '{"results": []}', response.body
  end

  test 'performs POST request successfully' do
    stub_request(:post, 'https://example.com/api')
      .with(body: '{"query": "test"}')
      .to_return(status: 200, body: '{"status": "ok"}')

    client = HttpClientService.new('https://example.com/api')
    response = client.post(body: '{"query": "test"}')

    assert_predicate response, :success?
    assert_equal '{"status": "ok"}', response.body
  end

  test 'sends custom headers' do
    stub_request(:get, 'https://example.com/api')
      .with(headers: { 'X-Api-Key' => 'secret123' })
      .to_return(status: 200, body: 'ok')

    client = HttpClientService.new('https://example.com/api', headers: { 'X-Api-Key' => 'secret123' })
    response = client.get

    assert_predicate response, :success?
  end

  test 'applies basic auth from URL userinfo' do
    expected_auth = "Basic #{Base64.strict_encode64('user:pass')}"

    stub_request(:get, 'https://example.com/secure')
      .with(headers: { 'Authorization' => expected_auth })
      .to_return(status: 200, body: 'authenticated')

    client = HttpClientService.new('https://user:pass@example.com/secure')
    response = client.get

    assert_predicate response, :success?
    assert_equal 'authenticated', response.body
  end

  test 'applies basic auth from credentials parameter' do
    expected_auth = "Basic #{Base64.strict_encode64('apiuser:secret123')}"

    stub_request(:get, 'https://example.com/api')
      .with(headers: { 'Authorization' => expected_auth })
      .to_return(status: 200, body: 'api response')

    client = HttpClientService.new('https://example.com/api', credentials: 'apiuser:secret123')
    response = client.get

    assert_predicate response, :success?
    assert_equal 'api response', response.body
  end

  test 'credentials parameter takes precedence over URL userinfo' do
    # URL has user:pass but credentials param has different creds
    expected_auth = "Basic #{Base64.strict_encode64('override:newpass')}"

    stub_request(:get, 'https://example.com/api')
      .with(headers: { 'Authorization' => expected_auth })
      .to_return(status: 200, body: 'overridden')

    client = HttpClientService.new('https://user:pass@example.com/api', credentials: 'override:newpass')
    response = client.get

    assert_predicate response, :success?
    assert_equal 'overridden', response.body
  end

  test 'handles password with colon in credentials' do
    # Password contains a colon: "user:pass:with:colons"
    expected_auth = "Basic #{Base64.strict_encode64('user:pass:with:colons')}"

    stub_request(:get, 'https://example.com/api')
      .with(headers: { 'Authorization' => expected_auth })
      .to_return(status: 200, body: 'ok')

    client = HttpClientService.new('https://example.com/api', credentials: 'user:pass:with:colons')
    response = client.get

    assert_predicate response, :success?
  end

  test 'merges additional query params with URL params' do
    stub_request(:get, 'https://example.com/search')
      .with(query: { 'q' => 'test', 'rows' => '10' })
      .to_return(status: 200, body: 'results')

    client = HttpClientService.new('https://example.com/search?q=test')
    response = client.get(params: { 'rows' => '10' })

    assert_predicate response, :success?
  end

  test 'follows redirects' do
    stub_request(:get, 'https://example.com/old')
      .to_return(status: 302, headers: { 'Location' => 'https://example.com/new' })

    stub_request(:get, 'https://example.com/new')
      .to_return(status: 200, body: 'redirected content')

    client = HttpClientService.new('https://example.com/old')
    response = client.get

    assert_predicate response, :success?
    assert_equal 'redirected content', response.body
  end

  test 'handles connection failure' do
    stub_request(:get, 'https://unreachable.example.com/api').to_raise(Faraday::ConnectionFailed)

    client = HttpClientService.new('https://unreachable.example.com/api')

    assert_raises(Faraday::ConnectionFailed) do
      client.get
    end
  end

  test 'handles timeout' do
    stub_request(:get, 'https://slow.example.com/api').to_timeout

    client = HttpClientService.new('https://slow.example.com/api', timeout: 1)

    assert_raises(Faraday::ConnectionFailed) do
      client.get
    end
  end

  test 'handles array header values' do
    stub_request(:get, 'https://example.com/api')
      .with(headers: { 'Accept' => 'text/html, application/json' })
      .to_return(status: 200, body: 'ok')

    client = HttpClientService.new(
      'https://example.com/api',
      headers: { 'Accept' => [ 'text/html', 'application/json' ] }
    )
    response = client.get

    assert_predicate response, :success?
  end

  test 'handles empty path' do
    stub_request(:get, 'https://example.com/')
      .to_return(status: 200, body: 'homepage')

    client = HttpClientService.new('https://example.com')
    response = client.get

    assert_predicate response, :success?
    assert_equal 'homepage', response.body
  end

  test 'converts non-string header values to strings' do
    # Test that integer, boolean, and other non-string values are converted to strings
    # This prevents "undefined method 'strip' for Integer" errors
    stub_request(:get, 'https://example.com/api')
      .with(headers: {
        'X-Retry-Count' => '3',
        'X-Debug'       => 'true',
        'X-Version'     => '1.5',
      })
      .to_return(status: 200, body: 'ok')

    client = HttpClientService.new(
      'https://example.com/api',
      headers: {
        'X-Retry-Count' => 3,
        'X-Debug'       => true,
        'X-Version'     => 1.5,
      }
    )
    response = client.get

    assert_predicate response, :success?
  end
end
