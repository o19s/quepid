# frozen_string_literal: true

require 'ipaddr'

class ProxyController < ApplicationController
  before_action :require_login
  before_action :validate_proxy_url!, only: [ :fetch ]
  skip_before_action :verify_authenticity_token, only: [ :fetch ]

  # The proxy requires an authenticated session. To exercise it from curl, first log in
  # and capture the session cookie, then reuse it on each request:
  #
  # curl -c cookies.txt -X POST "http://localhost:3000/users/login" \
  #   -H "Content-Type: application/json" \
  #   -d '{"user":{"email":"YOUR@EMAIL","password":"YOUR_PASSWORD"}}'
  #
  # curl -b cookies.txt -X GET "http://localhost:3000/proxy/fetch?url=https://quepid-solr.dev.o19s.com/solr/tmdb/select&q=*:*"
  # curl -b cookies.txt -X POST "http://localhost:3000/proxy/fetch?url=https://quepid-solr.dev.o19s.com/solr/tmdb/query" -d '{"query":"star"}'
  # curl -b cookies.txt -X GET "http://localhost:3000/proxy/fetch?url=http://quepid-solr.dev.o19s.com:8985/solr/media/select&q=*:*" -u 'solr:SolrRocks'
  #
  # Note: the target URL must resolve to a public IP. Loopback, link-local, and RFC1918
  # private ranges are blocked by validate_proxy_url!.
  #
  def fetch
    url_param = proxy_url_params
    proxy_debug = 'true' == params[:proxy_debug]

    headers = build_forwarded_headers
    headers['Content-Type'] = 'application/json'

    credentials = lookup_search_endpoint_credentials

    client = HttpClientService.new(url_param, headers: headers, credentials: credentials, debug: proxy_debug)

    response = if request.get?
                 perform_get_request(client, url_param)
               elsif request.post?
                 perform_post_request(client)
               end

    render_response(response)
  rescue Faraday::ConnectionFailed => e
    render json: { proxy_error: e.message }, status: :internal_server_error
  end

  def proxy_url_params
    params.require(:url)
  end

  private

  def perform_get_request client, url_param
    excluded_keys = [ :url, :action, :controller, :proxy_debug, :search_endpoint_id ]
    query_params = request.query_parameters.except(*excluded_keys)
    body_params = request.request_parameters.except(*query_params.keys)

    # Handle extra query param embedded in the URL (e.g., url=http://example.com/search?q=test&rows=10)
    extra_params = extract_extra_url_params(url_param)

    body = body_params.present? ? body_params.first.first : nil

    client.get(params: query_params.merge(extra_params), body: body)
  end

  def perform_post_request client
    excluded_keys = [ :url, :action, :controller, :proxy_debug, :search_endpoint_id ]
    query_params = request.query_parameters.except(*excluded_keys)
    body_params = request.request_parameters.except(*query_params.keys)

    body = body_params.present? ? request.raw_post : nil

    client.post(params: query_params, body: body)
  end

  def extract_extra_url_params url_param
    return {} unless url_param.include?('?')

    # Handle URLs like http://myserver.com/search?q=tiger or http://myserver.com/search?q=tiger?
    extra_query_param = url_param.split('?', 2).last.split('=')
    { extra_query_param.first => extra_query_param.second }
  end

  def build_forwarded_headers
    headers = {}

    # Collect headers from the Rack env. Rails exposes most incoming request headers
    # with an "HTTP_" prefix (e.g., "HTTP_X_CUSTOM_HEADER"). Certain important headers
    # like "Authorization" are exposed without the prefix.
    matching_headers = request.headers.select do |name, _|
      (name.start_with?('HTTP') || 'Authorization' == name) && !rack_header?(name)
    end

    matching_headers.each do |name, value|
      # Normalize: strip leading HTTP_ if present, convert underscores to dashes
      converted_name = name.start_with?('HTTP_') ? name.sub('HTTP_', '') : name
      converted_name = converted_name.tr('_', '-')

      header_value = value.is_a?(Array) ? value.join(', ') : value
      headers[converted_name] = header_value
    end

    headers
  end

  def validate_proxy_url!
    uri = Addressable::URI.parse(proxy_url_params)

    unless %w[http https].include?(uri.scheme) && uri.host.present?
      render json: { proxy_error: 'Invalid proxy URL' }, status: :bad_request
      return
    end

    addresses = Addrinfo.getaddrinfo(uri.host, nil, :UNSPEC, :STREAM).map do |addrinfo|
      IPAddr.new(addrinfo.ip_address)
    end

    render json: { proxy_error: 'Proxy URL resolves to a disallowed address' }, status: :bad_request if addresses.any? { |address| blocked_proxy_address?(address) }
  rescue Addressable::URI::InvalidURIError, SocketError, IPAddr::InvalidAddressError
    render json: { proxy_error: 'Invalid proxy URL' }, status: :bad_request
  end

  def lookup_search_endpoint_credentials
    return nil unless current_user.present? && params[:search_endpoint_id].present?

    search_endpoint = current_user.search_endpoints_involved_with.find_by(id: params[:search_endpoint_id])
    search_endpoint&.basic_auth_credential
  end

  def blocked_proxy_address? address
    return true if address.loopback?
    return true if address.link_local?

    private_ranges = [
      IPAddr.new('10.0.0.0/8'),
      IPAddr.new('172.16.0.0/12'),
      IPAddr.new('192.168.0.0/16'),
      IPAddr.new('fc00::/7')
    ]

    private_ranges.any? { |range| range.include?(address) }
  end

  def rack_header? header_name
    predefined_rack_headers = %w[
      HTTP_VERSION HTTP_ACCEPT HTTP_ACCEPT_CHARSET HTTP_ACCEPT_ENCODING
      HTTP_ACCEPT_LANGUAGE HTTP_CACHE_CONTROL HTTP_CONNECTION HTTP_HOST
      HTTP_REFERER HTTP_USER_AGENT HTTP_X_REQUEST_ID
      HTTP_COOKIE HTTP_ORIGIN HTTP_SEC_FETCH_SITE HTTP_SEC_FETCH_MODE
      HTTP_SEC_FETCH_DEST HTTP_SEC_FETCH_USER HTTP_SEC_CH_UA
      HTTP_SEC_CH_UA_MOBILE HTTP_SEC_CH_UA_PLATFORM HTTP_PRIORITY
    ]

    predefined_rack_headers.include?(header_name)
  end

  def render_response response
    content_type = response.headers['content-type'] || 'application/octet-stream'

    # Try to parse as JSON if it looks like JSON
    if content_type.include?('application/json')
      begin
        data = JSON.parse(response.body)
        render json: data, status: response.status
        return
      rescue JSON::ParserError
        # Fall through to render as-is
      end
    end

    # Render with original content type (HTML, plain text, etc.)
    render body: response.body, status: response.status, content_type: content_type
  end
end
