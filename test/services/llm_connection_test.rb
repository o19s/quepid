# frozen_string_literal: true

require 'test_helper'

class LlmConnectionTest < ActiveSupport::TestCase
  let(:url) { 'https://llm.example.com' }

  test 'builds a JSON in, JSON out connection for the given url' do
    conn = LlmConnection.build(url: url)

    assert_equal url, conn.url_prefix.to_s.chomp('/')
    handlers = conn.builder.handlers.map(&:name)

    assert_includes handlers, 'Faraday::Request::Json'
    assert_includes handlers, 'Faraday::Response::Json'
    assert_includes handlers, 'Faraday::Retry::Middleware'
  end

  test 'retries rate limiting and overloaded responses, not every failure' do
    assert_equal [ 429, 529 ], LlmConnection::RETRY_STATUSES
    assert_equal 3, LlmConnection::RETRY_OPTIONS[:max]
    assert_not_includes LlmConnection::RETRY_STATUSES, 500
  end

  test 'the backoff interval comes from configuration' do
    original = Rails.configuration.llm_retry_interval
    Rails.configuration.llm_retry_interval = 7

    assert_equal 7, LlmConnection.options[:interval]
  ensure
    Rails.configuration.llm_retry_interval = original
  end

  test 'an unconfigured backoff interval falls back rather than raising' do
    # e.g. a server still running from before customize_quepid.rb set it.
    assert_equal LlmConnection::DEFAULT_INTERVAL, LlmConnection.configured_interval(Object.new)
    assert_equal 5, LlmConnection.configured_interval(Struct.new(:llm_retry_interval).new(5))
  end

  test 'parses a JSON body into a hash' do
    stub_request(:post, "#{url}/v1/chat/completions")
      .to_return(status: 200, body: { ok: true }.to_json, headers: { 'Content-Type' => 'application/json' })

    response = LlmConnection.build(url: url).post('v1/chat/completions', { hello: 'world' })

    assert_equal({ 'ok' => true }, response.body)
  end

  describe 'retrying a POST, which is every call a judge makes' do
    # Collapse the backoff so the suite doesn't actually sleep 2s, 4s, 8s.
    let(:impatient) { { interval: 0, backoff_factor: 1, interval_randomness: 0 } }

    def post_to url, retry_options
      LlmConnection.build(url: url, retry_options: retry_options).post('v1/chat/completions', {})
    end

    test 'a rate limited POST is retried and can then succeed' do
      stub_request(:post, "#{url}/v1/chat/completions")
        .to_return({ status: 429, body: '{}' },
                   { status: 200, body: { ok: true }.to_json, headers: { 'Content-Type' => 'application/json' } })

      response = post_to(url, impatient)

      assert_equal 200, response.status
      assert_requested :post, "#{url}/v1/chat/completions", times: 2
    end

    test 'an overloaded POST is retried too, and gives up after max attempts' do
      stub_request(:post, "#{url}/v1/chat/completions").to_return(status: 529, body: '{}')

      response = post_to(url, impatient)

      assert_equal 529, response.status
      # the first attempt plus RETRY_OPTIONS[:max] retries
      assert_requested :post, "#{url}/v1/chat/completions", times: 4
    end

    test 'a POST that fails any other way is left alone' do
      stub_request(:post, "#{url}/v1/chat/completions").to_return(status: 500, body: '{}')

      response = post_to(url, impatient)

      assert_equal 500, response.status
      assert_requested :post, "#{url}/v1/chat/completions", times: 1
    end

    # The request may have reached the provider and been billed, so repeating it
    # is not free the way repeating a refused one is.
    test 'a POST that times out is not retried' do
      stub_request(:post, "#{url}/v1/chat/completions").to_timeout

      assert_raises(Faraday::Error) { post_to(url, impatient) }
      assert_requested :post, "#{url}/v1/chat/completions", times: 1
    end
  end
end
