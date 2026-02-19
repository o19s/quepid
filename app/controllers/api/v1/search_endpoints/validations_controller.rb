# frozen_string_literal: true

require 'resolv'
require 'ipaddr'

module Api
  module V1
    module SearchEndpoints
      # Validates a search endpoint URL: checks format, HTTPS, and reachability.
      # POST /api/v1/search_endpoints/validation
      class ValidationsController < Api::ApiController
        # Private IP ranges to block (SSRF protection)
        BLOCKED_RANGES = [
          IPAddr.new('127.0.0.0/8'), # loopback
          IPAddr.new('10.0.0.0/8'),         # RFC 1918
          IPAddr.new('172.16.0.0/12'),      # RFC 1918
          IPAddr.new('192.168.0.0/16'),     # RFC 1918
          IPAddr.new('169.254.0.0/16'),     # link-local (cloud metadata)
          IPAddr.new('0.0.0.0/8'),          # "this" network
          IPAddr.new('::1/128'),            # IPv6 loopback
          IPAddr.new('fc00::/7'),           # IPv6 unique-local
          IPAddr.new('fe80::/10')           # IPv6 link-local
        ].freeze

        # POST /api/v1/search_endpoints/validation
        #
        # Body: { url: "https://..." }
        # Returns: { valid: bool, warnings: [...], error: "..." }
        # rubocop:disable Metrics/AbcSize, Metrics/CyclomaticComplexity, Metrics/MethodLength, Metrics/PerceivedComplexity
        def create
          url_string = params[:url].to_s.strip
          warnings = []

          # Validate URL format
          begin
            uri = URI.parse(url_string)
          rescue URI::InvalidURIError
            render json: { valid: false, warnings: [], error: 'Invalid URL format' }
            return
          end

          unless uri.is_a?(URI::HTTP) || uri.is_a?(URI::HTTPS)
            render json: { valid: false, warnings: [], error: 'URL must start with http:// or https://' }
            return
          end

          warnings << 'Using HTTP instead of HTTPS — credentials will be sent in plain text' if 'http' == uri.scheme

          # SSRF protection: resolve hostname and block private/internal IPs
          begin
            resolved_ips = Resolv.getaddresses(uri.host)
          rescue Resolv::ResolvError
            render json: { valid: false, warnings: warnings, error: 'DNS lookup failed' }
            return
          end

          if resolved_ips.empty?
            render json: { valid: false, warnings: warnings, error: 'DNS lookup returned no addresses' }
            return
          end

          blocked_ip = resolved_ips.find { |ip_str| private_ip?(ip_str) }
          if blocked_ip
            render json: { valid: false, warnings: warnings, error: 'URL resolves to a private/internal address' }
            return
          end

          # Check reachability with HEAD request (5s timeout)
          begin
            http = Net::HTTP.new(uri.host, uri.port)
            http.use_ssl = ('https' == uri.scheme)
            http.open_timeout = 5
            http.read_timeout = 5
            http.verify_mode = OpenSSL::SSL::VERIFY_PEER

            response = http.request_head(uri.request_uri.presence || '/')

            if response.code.to_i >= 400 && 401 != response.code.to_i && 403 != response.code.to_i
              render json: { valid: false, warnings: warnings, error: "Server returned HTTP #{response.code}" }
              return
            end

            # 401/403 is OK — it means the server is reachable but requires auth
            warnings << "Server requires authentication (HTTP #{response.code})" if [ 401, 403 ].include?(response.code.to_i)
          rescue Errno::ECONNREFUSED
            render json: { valid: false, warnings: warnings, error: 'Connection refused' }
            return
          rescue Net::OpenTimeout, Net::ReadTimeout
            render json: { valid: false, warnings: warnings, error: 'Connection timed out (5s)' }
            return
          rescue SocketError
            render json: { valid: false, warnings: warnings, error: 'DNS lookup failed' }
            return
          rescue OpenSSL::SSL::SSLError
            render json: { valid: false, warnings: warnings, error: 'SSL certificate error' }
            return
          rescue StandardError
            render json: { valid: false, warnings: warnings, error: 'Connection failed' }
            return
          end

          render json: { valid: true, warnings: warnings, error: nil }
        end
        # rubocop:enable Metrics/AbcSize, Metrics/CyclomaticComplexity, Metrics/MethodLength, Metrics/PerceivedComplexity

        private

        def private_ip? ip_str
          addr = IPAddr.new(ip_str)
          BLOCKED_RANGES.any? { |range| range.include?(addr) }
        rescue IPAddr::InvalidAddressError
          true # treat unparseable addresses as blocked
        end
      end
    end
  end
end
