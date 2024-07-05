# frozen_string_literal: true

# rubocop:disable Metrics/ClassLength
class FetchService
  # include ProgressIndicator

  attr_reader :logger, :options

  def initialize opts = {}
    default_options = {
      logger:         Rails.logger,
      snapshot_limit: 10,
      debug_mode:     false,
    }

    @options = default_options.merge(opts)

    @logger = @options[:logger]
  end

  def begin acase, atry
    @case = acase
    @try = atry

    @snapshot = @case.snapshots.build(name: 'Fetch [BEGUN]')
    @snapshot.scorer = @case.scorer
    @snapshot.try = @try
    @snapshot.save!
    @snapshot
  end

  def store_query_results query, docs
    snapshot_query = @snapshot.snapshot_queries.create(query: query, number_of_results: results.count)

    snapshot_manager = SnapshotManager.new(@snapshot)
    snapshot_manager.setup_docs_for_query(snapshot_query, docs)
    snapshot_query
  end

  def complete
    @snapshot.name = 'Fetch [COMPLETED]'
    @snapshot.save!

    # Keep the first snapshot, and the most recents, deleting the ones out of the middle.
    # Not the best sampling!
    snapshot_to_delete = @case.snapshots[1..((@options[:snapshot_limit] * -1) + @case.snapshots.count)]
    snapshot_to_delete&.each(&:destroy)
  end

  # rubocop:disable Metrics/MethodLength
  def get_connection url, debug_mode, credentials, custom_headers
    if @connection.nil?
      @connection = Faraday.new(url: url) do |faraday|
        # Configure the connection options, such as headers or middleware
        faraday.response :follow_redirects
        faraday.response :logger, nil, { headers: debug_mode, bodies: debug_mode, errors: !Rails.env.test? }
        faraday.ssl.verify = false
        # faraday.request :url_encoded

        # matching_headers = request.headers.select { |name, _| name.start_with?('HTTP') && !rack_header?(name) }

        # matching_headers.each do |name, value|
        #  converted_name = name.sub('HTTP_', '')
        #  converted_name = converted_name.tr('_', '-')
        #  faraday.headers[converted_name] = value
        # end

        faraday.headers['Content-Type'] = 'application/json'
        unless credentials.nil?
          username, password = credentials.split(':')
          faraday.headers['Authorization'] = "Basic #{Base64.strict_encode64("#{username}:#{password}")}"
        end

        unless custom_headers.nil?
          puts JSON.parse(custom_headers).to_h
          JSON.parse(custom_headers).to_h.each do |key, value|
            faraday.headers[key] = value
          end
        end
        faraday.adapter Faraday.default_adapter
      end
    end
    @connection
  end
  # rubocop:enable Metrics/MethodLength

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/PerceivedComplexity
  def create_request atry, query
    search_endpoint = atry.search_endpoint
    debug_mode = true
    connection = get_connection search_endpoint.endpoint_url, debug_mode, search_endpoint.basic_auth_credential,
                                search_endpoint.custom_headers

    http_verb = search_endpoint.api_method # .to_sym

    # TODO: Make api_method a enum
    http_verb = :get if 'JSONP' == http_verb
    http_verb = :get if 'GET' == http_verb
    http_verb = :post if 'POST' == http_verb
    http_verb = :put if 'PUT' == http_verb
    puts "Running query with #{http_verb}"

    args = atry.args

    response = nil
    # response = connection.run_request(http_verb, search_endpoint.endpoint_url) do |req|
    case http_verb
    when :get
      response = connection.get do |req|
        req.url search_endpoint.endpoint_url
        args.each_value do |value|
          value.map! { |val| val.gsub("\#$query##", query.query_text) }

          puts "Here is the key: #{key}"
          puts "Here is the value: #{value}"
          # if value.is_a?(Array)
          # very unsure how we are handling the value, it may always be a array?
          value.each do |item|
            req.params[key] = item
          end
        end

        # Add any additional headers, params, or other options as needed
      end
    when :post
      response = connection.post do |req|
        req.url search_endpoint.endpoint_url
        args = replace_values(args, query.query_text)
        req.body = args
        # Add any additional headers, params, or other options as needed
      end
    when :put
      response = connection.put do |req|
        req.url search_endpoint.endpoint_url
        args = replace_values(args, query.query_text)
        req.body = args
        # Add any additional headers, params, or other options as needed
      end
    else
      raise "Invalid HTTP verb: #{http_verb}"
    end

    response
  end
  # rubocop:enable Metrics/AbcSize
  # rubocop:enable Metrics/CyclomaticComplexity
  # rubocop:enable Metrics/MethodLength
  # rubocop:enable Metrics/PerceivedComplexity

  # rubocop:disable Metrics/PerceivedComplexity
  def replace_values data, query_text
    if data.is_a?(Hash)
      data.each do |key, value|
        if "\#$query##" == value
          data[key] = query_text
        elsif value.is_a?(Hash) || value.is_a?(Array)
          replace_values(value, query_text)
        end
      end
    elsif data.is_a?(Array)
      data.each { |item| replace_values(item, query_text) }
    end
    data
  end
  # rubocop:enable Metrics/PerceivedComplexity
end
# rubocop:enable Metrics/ClassLength
