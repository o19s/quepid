# frozen_string_literal: true

require 'faraday'
require 'faraday/follow_redirects'

require 'addressable/uri'
require 'base64'

class DownloadPage < RubyLLM::Tool
  description 'Downloads a specific web search results page'
  param :url, desc: 'Webpage Search Results URL (e.g., https://search.ed.ac.uk/?q=mental)'

  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/PerceivedComplexity
  def execute url:
    # Validate URL format
    return { error: 'Invalid URL format. Must start with http:// or https://' } unless url&.match?(%r{\Ahttps?://.+}i)

    # Use Addressable::URI instead of straight up URI to support non ascii characters like café
    uri = Addressable::URI.parse(url)
    url_without_path = "#{uri.scheme}://#{uri.host}"
    url_without_path += ":#{uri.port}" unless uri.port.nil?

    connection = Faraday.new(url: url_without_path) do |faraday|
      # Configure the connection options, such as headers or middleware
      faraday.response :follow_redirects
      faraday.ssl.verify = false
      faraday.request :url_encoded

      # Set User-Agent header like proxy controller sets Content-Type
      faraday.headers['User-Agent'] = 'Quepid/1.0 (Web Scraper)'

      # Handle basic auth if present in URL
      has_credentials = !uri.userinfo.nil?
      if has_credentials
        username, password = uri.userinfo.split(':')
        faraday.headers['Authorization'] = "Basic #{Base64.strict_encode64("#{username}:#{password}")}"
      end

      faraday.adapter Faraday.default_adapter
    end

    response = connection.get do |req|
      req.path = uri.path
      req.options.timeout = 30        # 30 second timeout
      req.options.open_timeout = 10   # 10 second connection timeout

      # Handle query parameters if present in URL
      if uri.query
        uri.query_values&.each do |key, value|
          req.params[key] = value
        end
      end
    end

    # Check for successful response
    return { error: "HTTP #{response.status}: Failed to fetch URL" } unless response.success?

    # Check if we got content
    return { error: 'No content received from URL' } if response.body.blank?

    data = response.body
    data
  rescue Faraday::TimeoutError
    { error: 'Request timed out' }
  rescue Faraday::ConnectionFailed => e
    { error: "Connection failed: #{e.message}" }
  rescue StandardError => e
    { error: e.message }
  end
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/PerceivedComplexity
end
