# frozen_string_literal: true

require 'faraday'
require 'faraday/follow_redirects'
require 'addressable/uri'
require 'base64'

# Shared HTTP client service for making external HTTP requests.
# Used by ProxyController, DownloadPage, and MapperWizardService.
#
# Features:
# - URL parsing with Addressable::URI (supports non-ASCII characters like café)
# - Basic auth extracted from URL userinfo
# - Custom headers support
# - Configurable timeouts
# - Debug logging
# - Follow redirects
#
# Example usage:
#   client = HttpClientService.new('https://example.com/search?q=test')
#   response = client.get
#
#   client = HttpClientService.new('https://api.example.com', headers: { 'X-Api-Key' => 'secret' })
#   response = client.post(body: '{"query": "test"}')
#
class HttpClientService
  attr_reader :uri

  def initialize url, headers: {}, debug: false, timeout: 30, open_timeout: 10
    @url = url
    @headers = headers
    @debug = debug
    @timeout = timeout
    @open_timeout = open_timeout
    @uri = Addressable::URI.parse(url)
  end

  # Perform a GET request
  # @param params [Hash] Additional query parameters
  # @param body [String] Optional request body
  # @return [Faraday::Response]
  def get params: {}, body: nil
    connection.get do |req|
      req.path = @uri.path.presence || '/'
      apply_timeouts(req)
      apply_url_query_params(req)
      params.each { |key, value| req.params[key] = value }
      req.body = body if body.present?
    end
  end

  # Perform a POST request
  # @param params [Hash] Additional query parameters
  # @param body [String] Request body
  # @return [Faraday::Response]
  def post params: {}, body: nil
    connection.post do |req|
      req.path = @uri.path.presence || '/'
      apply_timeouts(req)
      apply_url_query_params(req)
      params.each { |key, value| req.params[key] = value }
      req.body = body if body.present?
    end
  end

  # Build the base URL without path (scheme://host:port)
  # @return [String]
  def url_without_path
    result = "#{@uri.scheme}://#{@uri.host}"
    result += ":#{@uri.port}" unless @uri.port.nil?
    result
  end

  # Check if URL has embedded credentials
  # @return [Boolean]
  def has_credentials?
    !@uri.userinfo.nil?
  end

  private

  def connection
    @connection ||= build_connection
  end

  def build_connection
    Faraday.new(url: url_without_path) do |faraday|
      faraday.response :follow_redirects
      faraday.response :logger, nil, log_options if @debug
      faraday.ssl.verify = false
      faraday.request :url_encoded

      apply_headers(faraday)
      apply_basic_auth(faraday)

      faraday.adapter Faraday.default_adapter
    end
  end

  def apply_headers faraday
    @headers.each do |name, value|
      header_value = value.is_a?(Array) ? value.join(', ') : value
      faraday.headers[name] = header_value
    end
  end

  def apply_basic_auth faraday
    return unless has_credentials?

    username, password = @uri.userinfo.split(':')
    faraday.headers['Authorization'] = "Basic #{Base64.strict_encode64("#{username}:#{password}")}"
  end

  def apply_timeouts req
    req.options.timeout = @timeout
    req.options.open_timeout = @open_timeout
  end

  def apply_url_query_params req
    return unless @uri.query

    @uri.query_values&.each do |key, value|
      req.params[key] = value
    end
  end

  def log_options
    { headers: true, bodies: true, errors: !Rails.env.test? }
  end
end
