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

  test 'strips css styling from html' do
    html_with_styles = <<~HTML
      <html>
        <head>
          <title>Test Page</title>
          <style>body { color: red; }</style>
          <link rel="stylesheet" href="styles.css">
        </head>
        <body style="background: blue;" class="main-content">
          <div style="font-size: 14px;" class="content">
            <script>alert('hello');</script>
            <p onclick="doSomething()">Clean content</p>
            <a href="javascript:void(0)">Bad link</a>
            <a href="https://example.com">Good link</a>
          </div>
        </body>
      </html>
    HTML

    stub_request(:get, 'https://example.com')
      .to_return(status: 200, body: html_with_styles)

    result = @tool.execute(url: 'https://example.com')

    assert result.is_a?(String), 'Should return cleaned HTML string'
    assert_not result.include?('<style>'), 'Should remove style tags'
    assert_not result.include?('rel="stylesheet"'), 'Should remove stylesheet links'
    assert_not result.include?('style='), 'Should remove inline styles'
    assert_not result.include?('class='), 'Should remove class attributes'
    assert_not result.include?('<script>'), 'Should remove script tags'
    assert_not result.include?('onclick='), 'Should remove event handlers'
    assert_not result.include?('javascript:'), 'Should remove javascript URLs'
    assert result.include?('Clean content'), 'Should preserve text content'
    assert result.include?('https://example.com'), 'Should preserve regular URLs'
  end

  test 'handles general exceptions' do
    stub_request(:get, 'https://example.com').to_raise(StandardError.new('Something went wrong'))

    result = @tool.execute(url: 'https://example.com')
    assert result.is_a?(Hash), 'Should return error hash for general exception'
    assert result.key?(:error), 'Should have error key'
    assert result[:error].include?('Something went wrong'), 'Should include exception message'
  end
end
