class ProxyController < ApplicationController
  skip_before_action :require_login
  skip_before_action :verify_authenticity_token, only: [ :fetch ]
  # curl -X GET "http://localhost:3000/proxy/fetch?url=https://quepid-solr.dev.o19s.com/solr/tmdb/select&q=*:*"
  # curl -X POST "http://localhost:3000/proxy/fetch?url=https://quepid-solr.dev.o19s.com/solr/tmdb/query" -d '{"query":"star"}'
  # 
  def fetch
      
      uri = URI.parse(params[:url])
      url_without_path = "#{uri.scheme}://#{uri.host}"
      url_without_path += ":#{uri.port}" unless uri.port.nil?
      
      connection = Faraday.new(url: url_without_path) do |faraday|
        # Configure the connection options, such as headers or middleware
        faraday.ssl.verify = false
        faraday.headers['Content-Type'] = 'application/json'
        faraday.adapter Faraday.default_adapter
      end
  
      adapter_name = connection.adapter
      
      response = connection.get do |req|
        req.path = uri.path
        excluded_keys = [:url, :action, :controller]
        query_params = request.query_parameters.except(*excluded_keys)
        body_params = request.request_parameters.except(*query_params.keys)

        query_params.each do |param|
          req.params[param.first] = param.second
        end
        unless body_params.empty?
          json_query = body_params.first.first
          req.body = json_query
        end
      end
  
      if response.success?
        data = JSON.parse(response.body)
        # Process the data as needed
        render json: data
      else
        error_message = response.status.to_s + ' ' + response.reason_phrase
        # Handle the error
        render json: { error: error_message }, status: :internal_server_error
      end
    end
end
