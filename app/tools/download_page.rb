# frozen_string_literal: true

class DownloadPage < RubyLLM::Tool
  description 'Downloads a specific web search results page'
  param :url, desc: 'Webpage Search Results URL (e.g., https://search.ed.ac.uk/?q=mental)'
  param :headers, desc: 'Custom HTTP headers as JSON string (e.g., {"X-Api-Key": "secret"})', required: false
  param :credentials, desc: 'Basic auth credentials in format "username:password"', required: false

  def execute url:, headers: nil, credentials: nil
    # Validate URL format
    return { error: 'Invalid URL format. Must start with http:// or https://' } unless url&.match?(%r{\Ahttps?://.+}i)

    parsed_headers = parse_headers(headers)
    parsed_headers['User-Agent'] ||= 'Quepid/1.0 (Web Scraper)'

    client = HttpClientService.new(url, headers: parsed_headers, credentials: credentials, timeout: 30, open_timeout: 10)
    response = client.get

    # Check for successful response
    return { error: "HTTP #{response.status}: Failed to fetch URL" } unless response.success?

    # Check if we got content
    return { error: 'No content received from URL' } if response.body.blank?

    response.body
  rescue Faraday::TimeoutError
    { error: 'Request timed out' }
  rescue Faraday::ConnectionFailed => e
    { error: "Connection failed: #{e.message}" }
  rescue JSON::ParserError => e
    { error: "Invalid headers JSON: #{e.message}" }
  rescue StandardError => e
    { error: e.message }
  end

  private

  def parse_headers headers
    return {} if headers.blank?

    parsed = JSON.parse(headers)
    return {} unless parsed.is_a?(Hash)

    parsed
  end
end
