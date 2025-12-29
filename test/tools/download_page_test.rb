# frozen_string_literal: true

require 'test_helper'

class DownloadPageTest < ActiveSupport::TestCase
  setup do
    @tool = DownloadPage.new
  end

  test 'tool responds to execute method' do
    assert_respond_to @tool, :execute
  end

  test 'validates url format' do
    # Test with invalid URL
    result = @tool.execute(url: 'not-a-url')
    assert result.is_a?(Hash), 'Should return error hash for invalid URL'
    assert result.key?(:error), 'Should have error key'
    assert result[:error].include?('Invalid URL format'), 'Should mention URL format error'
  end

  test 'validates nil url' do
    result = @tool.execute(url: nil)
    assert result.is_a?(Hash), 'Should return error hash for nil URL'
    assert result.key?(:error), 'Should have error key'
    assert result[:error].include?('Invalid URL format'), 'Should mention URL format error'
  end

  test 'validates empty url' do
    result = @tool.execute(url: '')
    assert result.is_a?(Hash), 'Should return error hash for empty URL'
    assert result.key?(:error), 'Should have error key'
    assert result[:error].include?('Invalid URL format'), 'Should mention URL format error'
  end

  test 'accepts valid http urls' do
    # Use WebMock to stub HTTP requests
    stub_request(:get, 'http://example.com')
      .to_return(status: 200, body: '<html><head><title>Test</title></head><body>Content</body></html>')

    result = @tool.execute(url: 'http://example.com')
    assert result.is_a?(String), 'Should return cleaned HTML string for valid URL'
    assert_not result.include?('error'), 'Should not contain error for valid response'
  end

  test 'accepts valid https urls' do
    # Use WebMock to stub HTTPS requests
    stub_request(:get, 'https://example.com')
      .to_return(status: 200, body: '<html><head><title>Test</title></head><body>Content</body></html>')

    result = @tool.execute(url: 'https://example.com')
    assert result.is_a?(String), 'Should return cleaned HTML string for valid URL'
    assert_not result.include?('error'), 'Should not contain error for valid response'
  end

  test 'handles http error responses' do
    stub_request(:get, 'https://example.com/not-found')
      .to_return(status: 404, body: 'Not Found')

    result = @tool.execute(url: 'https://example.com/not-found')
    assert result.is_a?(Hash), 'Should return error hash for HTTP error'
    assert result.key?(:error), 'Should have error key'
    assert result[:error].include?('HTTP 404'), 'Should mention HTTP status'
  end

  test 'handles empty response body' do
    stub_request(:get, 'https://example.com/empty')
      .to_return(status: 200, body: '')

    result = @tool.execute(url: 'https://example.com/empty')
    assert result.is_a?(Hash), 'Should return error hash for empty content'
    assert result.key?(:error), 'Should have error key'
    assert result[:error].include?('No content received'), 'Should mention no content'
  end

  test 'handles nil response body' do
    stub_request(:get, 'https://example.com/nil')
      .to_return(status: 200, body: nil)

    result = @tool.execute(url: 'https://example.com/nil')
    assert result.is_a?(Hash), 'Should return error hash for nil content'
    assert result.key?(:error), 'Should have error key'
    assert result[:error].include?('No content received'), 'Should mention no content'
  end

  test 'handles connection timeout' do
    stub_request(:get, 'https://slow.example.com').to_timeout

    result = @tool.execute(url: 'https://slow.example.com')
    assert result.is_a?(Hash), 'Should return error hash for timeout'
    assert result.key?(:error), 'Should have error key'
    # WebMock timeout may trigger different error paths, so just verify we get an error
    assert result[:error].is_a?(String), 'Should have error message'
    assert_not result[:error].empty?, 'Error message should not be empty'
  end

  test 'handles connection failure' do
    stub_request(:get, 'https://unreachable.example.com').to_raise(Faraday::ConnectionFailed)

    result = @tool.execute(url: 'https://unreachable.example.com')
    assert result.is_a?(Hash), 'Should return error hash for connection failure'
    assert result.key?(:error), 'Should have error key'
    assert result[:error].include?('Connection failed'), 'Should mention connection failure'
  end

  test 'returns raw html without cleaning' do
    html_content = <<~HTML
      <html>
        <head>
          <title>Test Page</title>
          <style>body { color: red; }</style>
        </head>
        <body>
          <div class="content">Raw HTML content</div>
        </body>
      </html>
    HTML

    stub_request(:get, 'https://example.com')
      .to_return(status: 200, body: html_content)

    result = @tool.execute(url: 'https://example.com')

    assert result.is_a?(String), 'Should return raw HTML string'
    assert result.include?('<style>'), 'Should preserve style tags'
    assert result.include?('class='), 'Should preserve class attributes'
    assert result.include?('Raw HTML content'), 'Should preserve content'
  end

  test 'handles general exceptions' do
    stub_request(:get, 'https://example.com').to_raise(StandardError.new('Something went wrong'))

    result = @tool.execute(url: 'https://example.com')
    assert result.is_a?(Hash), 'Should return error hash for general exception'
    assert result.key?(:error), 'Should have error key'
    assert result[:error].include?('Something went wrong'), 'Should include exception message'
  end
end
