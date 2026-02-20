# frozen_string_literal: true

class ProxyController < ApplicationController
  skip_before_action :require_login
  skip_before_action :verify_authenticity_token, only: [ :fetch ]

  # curl -X GET "http://localhost:3000/proxy/fetch?url=https://quepid-solr.dev.o19s.com/solr/tmdb/select&q=*:*"
  # curl -X POST "http://localhost:3000/proxy/fetch?url=https://quepid-solr.dev.o19s.com/solr/tmdb/query" -d '{"query":"star"}'
  # curl -X GET "http://localhost:3000/proxy/fetch?url=http://quepid-solr.dev.o19s.com:8985/solr/media/select&q=*:*" -u 'solr:SolrRocks'
  #
  def fetch
    url_param = proxy_url_params
    proxy_debug = deserialize_bool_param(params[:proxy_debug])

    headers = build_forwarded_headers
    headers['Content-Type'] = 'application/json'

    client = HttpClientService.new(url_param, headers: headers, debug: proxy_debug)

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
    excluded_keys = [ :url, :action, :controller, :proxy_debug ]
    query_params = request.query_parameters.except(*excluded_keys)
    body_params = request.request_parameters.except(*query_params.keys)

    # Handle extra query param embedded in the URL (e.g., url=http://example.com/search?q=test&rows=10)
    extra_params = extract_extra_url_params(url_param)

    body = body_params.present? ? body_params.first.first : nil

    client.get(params: query_params.merge(extra_params), body: body)
  end

  def perform_post_request client
    excluded_keys = [ :url, :action, :controller, :proxy_debug ]
    query_params = request.query_parameters.except(*excluded_keys)
    body_params = request.request_parameters.except(*query_params.keys)

    body = body_params.present? ? request.raw_post : nil

    client.post(params: query_params, body: body)
  end

  def extract_extra_url_params url_param
    UrlParserService.query_values(url_param)
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

  def rack_header? header_name
    predefined_rack_headers = %w[
      HTTP_VERSION HTTP_ACCEPT HTTP_ACCEPT_CHARSET HTTP_ACCEPT_ENCODING
      HTTP_ACCEPT_LANGUAGE HTTP_CACHE_CONTROL HTTP_CONNECTION HTTP_HOST
      HTTP_REFERER HTTP_USER_AGENT HTTP_X_REQUEST_ID
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
