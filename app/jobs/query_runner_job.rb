# frozen_string_literal: true

require 'action_controller'
require 'faraday'
require 'faraday/follow_redirects'

class QueryRunnerJob < ApplicationJob
  queue_as :bulk_processing

  # rubocop:disable Metrics/MethodLength
  def perform acase, _try
    query_count = acase.queries.count

    acase.queries.each_with_index do |query, counter|
      Turbo::StreamsChannel.broadcast_render_to(
        :notifications,
        target:  'notifications',
        partial: 'admin/query_runner/notification',
        locals:  { query: query, query_count: query_count, counter: counter }
      )

      sleep(2)
    end

    Turbo::StreamsChannel.broadcast_render_to(
      :notifications,
      target:  'notifications',
      partial: 'admin/query_runner/notification',
      locals:  { query: nil, query_count: query_count, counter: 0 }
    )
  end
  # rubocop:enable Metrics/MethodLength

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/PerceivedComplexity
  def fetch
    excluded_keys = [ :url, :action, :controller, :proxy_debug ]

    url_param = proxy_url_params

    proxy_debug = 'true' == params[:proxy_debug]

    uri = URI.parse(url_param)
    url_without_path = "#{uri.scheme}://#{uri.host}"
    url_without_path += ":#{uri.port}" unless uri.port.nil?

    connection = Faraday.new(url: url_without_path) do |faraday|
      # Configure the connection options, such as headers or middleware
      faraday.response :follow_redirects
      faraday.response :logger, nil, { headers: proxy_debug, bodies: proxy_debug, errors: !Rails.env.test? }
      faraday.ssl.verify = false
      faraday.request :url_encoded

      matching_headers = request.headers.select { |name, _| name.start_with?('HTTP') && !rack_header?(name) }

      matching_headers.each do |name, value|
        converted_name = name.sub('HTTP_', '')
        converted_name = converted_name.tr('_', '-')
        faraday.headers[converted_name] = value
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
          # not sure about this and the request.raw_post
          body_params = request.request_parameters.except(*query_params.keys)
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
        { json: data, status: response.status }
      rescue JSON::ParserError
        # sometimes the API is returning plain old text, like a "Unauthorized" type message.
        { json: { response: response.body }, status: response.status }
      end
    rescue Faraday::ConnectionFailed => e
      { json: { proxy_error: e.message }, status: :internal_server_error }
    end
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/PerceivedComplexity
end
