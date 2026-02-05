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
# - Basic auth extracted from URL userinfo or credentials parameter
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
#   client = HttpClientService.new('https://api.example.com', credentials: 'user:pass')
#   response = client.get
#
class HttpClientService
  attr_reader :uri

  # rubocop:disable Metrics/ParameterLists
  def initialize url, headers: {}, credentials: nil, debug: false, timeout: 30, open_timeout: 10
    @url = url
    @headers = headers
    @credentials = credentials
    @debug = debug
    @timeout = timeout
    @open_timeout = open_timeout
    @uri = Addressable::URI.parse(url)
  end
  # rubocop:enable Metrics/ParameterLists

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

  # Check if credentials are available (from parameter or URL userinfo)
  # @return [Boolean]
  def credentials?
    @credentials.present? || !@uri.userinfo.nil?
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
      header_value = if value.is_a?(Array)
                       value.join(', ')
                     else
                       value.to_s
                     end
      faraday.headers[name] = header_value
    end
  end

  def apply_basic_auth faraday
    # Prefer explicit credentials parameter over URL userinfo
    credentials = @credentials.presence || @uri.userinfo
    return if credentials.blank?

    username, password = credentials.split(':', 2)
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
