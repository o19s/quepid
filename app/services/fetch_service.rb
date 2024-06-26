# frozen_string_literal: true

class FetchService
  # include ProgressIndicator

  attr_reader :logger, :options

  def initialize url,proxy_debug, opts = {}
    default_options = {
      logger:             Rails.logger      
    }

    @options = default_options.merge(opts.deep_symbolize_keys)

    @url = url
    @proxy_debug = proxy_debug
    @logger = @options[:logger]
  end

  # rubocop:disable Metrics/AbcSize
  # rubocop:disable Metrics/CyclomaticComplexity
  # rubocop:disable Metrics/MethodLength
  # rubocop:disable Metrics/PerceivedComplexity
  def validate
    params_to_use = @data_to_process
    scorer_name = params_to_use[:scorer][:name]
    scorer = Scorer.find_by(name: scorer_name)
    if scorer.nil?
      @book.errors.add(:scorer, "with name '#{scorer_name}' needs to be migrated over first.")
    else
      @book.scorer = scorer
    end

    selection_strategy_name = params_to_use[:selection_strategy][:name]
    selection_strategy = SelectionStrategy.find_by(name: selection_strategy_name)
    if selection_strategy.nil?
      @book.errors.add(:selection_strategy,
                       "Selection strategy with name '#{selection_strategy_name}' needs to be migrated over first.")
    else
      @book.selection_strategy = selection_strategy
    end

    if params_to_use[:query_doc_pairs]
      list_of_emails_of_users = []
      params_to_use[:query_doc_pairs].each do |query_doc_pair|
        next unless query_doc_pair[:judgements]

        query_doc_pair[:judgements].each do |judgement|
          list_of_emails_of_users << judgement[:user_email] if judgement[:user_email].present?
        end
      end
      list_of_emails_of_users.uniq!
      list_of_emails_of_users.each do |email|
        unless User.exists?(email: email)
          if options[:force_create_users]
            User.invite!({ email: email, password: '', skip_invitation: true }, @current_user)
          else
            @book.errors.add(:base, "User with email '#{email}' needs to be migrated over first.")
          end
        end
      end
    end
  end

  def fetch
    excluded_keys = [ :url, :action, :controller, :proxy_debug ]

    url_param = @url

    proxy_debug = 'true' == @proxy_debug

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
