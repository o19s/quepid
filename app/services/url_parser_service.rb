# frozen_string_literal: true

require 'addressable/uri'

# Shared URL parsing logic used by ProxyController, ApplicationHelper, and
# Api::V1::SearchEndpoints::ValidationsController.
#
# Uses Addressable::URI for robust parsing (multi-param URLs, non-ASCII chars).
#
# @example Get scheme from URL
#   UrlParserService.scheme('https://example.com/path?q=1') # => "https"
#
# @example Extract query params from URL string
#   UrlParserService.query_values('http://example.com/search?q=test&rows=10')
#   # => {"q"=>"test", "rows"=>"10"}
#
# @example Parse URL for validation or HTTP requests
#   uri = UrlParserService.parse('https://example.com')
#   uri.host  # => "example.com"
#   uri.port  # => 443
#
module UrlParserService
  class << self
    # Parse a URL string. Returns Addressable::URI or nil on invalid input.
    #
    # @param url [String]
    # @return [Addressable::URI, nil]
    def parse url
      return nil if url.blank?

      Addressable::URI.parse(url.to_s.strip)
    rescue Addressable::URI::InvalidURIError => e
      Rails.logger.error("Invalid URL: #{url} - #{e.message}") if defined?(Rails)
      nil
    end

    # Extract the scheme (protocol) from a URL.
    #
    # @param url [String]
    # @return [String, nil] e.g. "https", "http", or nil if invalid
    def scheme url
      uri = parse(url)
      uri&.scheme
    end

    # Extract query parameters from a URL string as a hash.
    # Returns empty hash if URL has no query string or is invalid.
    #
    # @param url [String]
    # @return [Hash<String, String>]
    def query_values url
      uri = parse(url)
      return {} unless uri
      return {} unless url.to_s.include?('?')

      uri.query_values || {}
    end

    # Check if URL is HTTP or HTTPS. Returns false for invalid or other schemes.
    #
    # @param url [String]
    # @return [Boolean]
    def http_or_https? url
      s = scheme(url)&.downcase
      %w[http https].include?(s)
    end
  end
end
