# frozen_string_literal: true

require 'faraday'

# rubocop:disable Layout/LineLength
# rubocop:disable Metrics/AbcSize
# rubocop:disable Metrics/MethodLength
# rubocop:disable Metrics/PerceivedComplexity
# rubocop:disable Metrics/CyclomaticComplexity
class ProxyController < ApplicationController
  skip_before_action :require_login
  skip_before_action :verify_authenticity_token, only: [ :fetch ]
  # curl -X GET "http://localhost:3000/proxy/fetch?url=https://quepid-solr.dev.o19s.com/solr/tmdb/select&q=*:*"
  # curl -X POST "http://localhost:3000/proxy/fetch?url=https://quepid-solr.dev.o19s.com/solr/tmdb/query" -d '{"query":"star"}'
  #
  def fetch
    url_param = proxy_url_params

    uri = URI.parse(url_param)
    url_without_path = "#{uri.scheme}://#{uri.host}"
    url_without_path += ":#{uri.port}" unless uri.port.nil?

    connection = Faraday.new(url: url_without_path) do |faraday|
      # Configure the connection options, such as headers or middleware
      # faraday.response :logger, nil, { headers: true, bodies: true }
      faraday.response :logger, nil, { headers: false, bodies: false, errors: true }
      faraday.ssl.verify = false
      faraday.request :url_encoded

      matching_headers = request.headers.select { |name, _| name.start_with?('HTTP') && !rack_header?(name) }

      matching_headers.each do |name, value|
        converted_name = name.sub('HTTP_', '')
        converted_name = converted_name.tr('_', '-')
        faraday.headers[converted_name] = value
      end

      faraday.headers['Content-Type'] = 'application/json'
      faraday.adapter Faraday.default_adapter
    end

    if request.get?
      response = connection.get do |req|
        req.path = uri.path
        excluded_keys = [ :url, :action, :controller ]
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
          extra_query_param = url_param.split('?')[1].split('=')
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
        excluded_keys = [ :url, :action, :controller ]
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

    data = JSON.parse(response.body)
    # Process the data as needed
    render json: data, status: response.status
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
# rubocop:enable Layout/LineLength
# rubocop:enable Metrics/AbcSize
# rubocop:enable Metrics/MethodLength
# rubocop:enable Metrics/PerceivedComplexity
# rubocop:enable Metrics/CyclomaticComplexity
