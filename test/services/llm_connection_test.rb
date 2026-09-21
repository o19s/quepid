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

  test 'parses a JSON body into a hash' do
    stub_request(:post, "#{url}/v1/chat/completions")
      .to_return(status: 200, body: { ok: true }.to_json, headers: { 'Content-Type' => 'application/json' })

    response = LlmConnection.build(url: url).post('v1/chat/completions', { hello: 'world' })

    assert_equal({ 'ok' => true }, response.body)
  end

  # Documents today's reality rather than an intention: faraday-retry only
  # retries idempotent methods unless told otherwise, so a rate-limited POST --
  # which is every call a judge makes -- is returned to the caller on the first
  # try. See the NOTE in LlmConnection before changing this.
  test 'a rate limited POST is not actually retried yet' do
    stub_request(:post, "#{url}/v1/chat/completions").to_return(status: 429, body: '{}')

    response = LlmConnection.build(url: url).post('v1/chat/completions', {})

    assert_equal 429, response.status
    assert_requested :post, "#{url}/v1/chat/completions", times: 1
  end
end
