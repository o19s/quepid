# frozen_string_literal: true

require 'faraday'
require 'faraday/follow_redirects'

require 'addressable/uri'

# rubocop:disable Metrics/AbcSize
# rubocop:disable Metrics/MethodLength
# rubocop:disable Metrics/PerceivedComplexity
# rubocop:disable Metrics/CyclomaticComplexity
class ProxyController < ApplicationController
  skip_before_action :require_login
  skip_before_action :verify_authenticity_token, only: [ :fetch ]
  # curl -X GET "http://localhost:3000/proxy/fetch?url=https://quepid-solr.dev.o19s.com/solr/tmdb/select&q=*:*"
  # curl -X POST "http://localhost:3000/proxy/fetch?url=https://quepid-solr.dev.o19s.com/solr/tmdb/query" -d '{"query":"star"}'
  # curl -X GET "http://localhost:3000/proxy/fetch?url=http://quepid-solr.dev.o19s.com:8985/solr/media/select&q=*:*" -u 'solr:SolrRocks'
  #
  def fetch
    excluded_keys = [ :url, :action, :controller, :proxy_debug ]

    url_param = proxy_url_params

    proxy_debug = 'true' == params[:proxy_debug]

    # we use Addressable::URI instead of straight up URI to support non ascii characters like café
    uri = Addressable::URI.parse(url_param)
    url_without_path = "#{uri.scheme}://#{uri.host}"
    url_without_path += ":#{uri.port}" unless uri.port.nil?

    connection = Faraday.new(url: url_without_path) do |faraday|
      # Configure the connection options, such as headers or middleware
      faraday.response :follow_redirects
      faraday.response :logger, nil, { headers: proxy_debug, bodies: proxy_debug, errors: !Rails.env.test? }
      faraday.ssl.verify = false
      faraday.request :url_encoded

      # Collect headers coming from the Rack env. Rails exposes most incoming
      # request headers with an "HTTP_" prefix (e.g. "HTTP_X_CUSTOM_HEADER").
      # Certain important headers like "Authorization" are exposed without the
      # HTTP_ prefix, so include them explicitly. Also filter out known rack
      # control headers.
      matching_headers = request.headers.select do |name, _|
        (name.start_with?('HTTP') || 'Authorization' == name) && !rack_header?(name)
      end

      matching_headers.each do |name, value|
        # Normalize the header name: strip leading HTTP_ if present, convert
        # underscores to dashes to match typical HTTP header formatting.
        converted_name = name.start_with?('HTTP_') ? name.sub('HTTP_', '') : name
        converted_name = converted_name.tr('_', '-')
        # Some Rack headers may be provided as arrays or as values wrapped in
        # ActionDispatch::Http::Headers; ensure we extract a string value.
        header_value = if value.is_a?(Array)
                         value.join(', ')
                       else
                         value
                       end
        faraday.headers[converted_name] = header_value
      end

      faraday.headers['Content-Type'] = 'application/json'
      has_credentials = !uri.userinfo.nil?
      if has_credentials
        username, password = uri.userinfo.split(':')
        faraday.headers['Authorization'] = "Basic #{Base64.strict_encode64("#{username}:#{password}")}"
      end
      faraday.adapter Faraday.default_adapter
    end

    begin
      if request.get?
        response = connection.get do |req|
          req.path = uri.path
          query_params = request.query_parameters.except(*excluded_keys)
          body_params = request.request_parameters.except(*query_params.keys)

          query_params.each do |param|
            req.params[param.first] = param.second
          end

          # the url parameter often has a format like
          # http://myserver.com/search?query=text, and when this is passed in
          # we get http://localhost:3000/proxy/fetch?url=http://myserver.com/search?query=text&rows=10
          # which means the parameter "query=text" is lost because the URL is parsed and this part is dropped,
          # so here we add this one parameter back in if we have it.
          if url_param.include?('?')
            # sometimes our url looks like http://myserver.com/search?q=tiger
            # But it could also be http://myserver.com/search?q=tiger? and that needs handling via the special .split
            extra_query_param = url_param.split('?', 2).last.split('=')

            req.params[extra_query_param.first] = extra_query_param.second
          end
          unless body_params.empty?

            json_query = body_params.first.first
            req.body = json_query
          end
        end
      elsif request.post?
        response = connection.post do |req|
          req.path = uri.path
          query_params = request.query_parameters.except(*excluded_keys)
          body_params = request.request_parameters.except(*query_params.keys) # not sure about this and the request.raw_post
          query_params.each do |param|
            req.params[param.first] = param.second
          end
          unless body_params.empty?
            json_query = request.raw_post

            req.body = json_query
          end
        end
      end

      begin
        data = JSON.parse(response.body)
        render json: data, status: response.status
      rescue JSON::ParserError
        # sometimes the API is returning plain old text, like a "Unauthorized" type message.
        render plain: response.body, status: response.status
      end
    rescue Faraday::ConnectionFailed => e
      render json: { proxy_error: e.message }, status: :internal_server_error
    end
  end

  def proxy_url_params
    params.require(:url)
  end

  private

  def rack_header? header_name
    predefined_rack_headers = %w[
      HTTP_VERSION HTTP_ACCEPT HTTP_ACCEPT_CHARSET HTTP_ACCEPT_ENCODING
      HTTP_ACCEPT_LANGUAGE HTTP_CACHE_CONTROL HTTP_CONNECTION HTTP_HOST
      HTTP_REFERER HTTP_USER_AGENT HTTP_X_REQUEST_ID
    ]

    predefined_rack_headers.include?(header_name)
  end
end
# rubocop:enable Metrics/AbcSize
# rubocop:enable Metrics/MethodLength
# rubocop:enable Metrics/PerceivedComplexity
# rubocop:enable Metrics/CyclomaticComplexity
