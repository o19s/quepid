# frozen_string_literal: true

module DatasetIndex
  # Creates the index of a definition on a search endpoint, for the engines Quepid knows how to: Elasticsearch and
  # OpenSearch, Solr (adds the fields to an existing collection) and Qdrant. It sends a write to the endpoint, so
  # callers ask the user first, and show them the definition.
  class Applier
    def initialize endpoint
      @endpoint = endpoint
    end

    def apply definition
      raise Unsupported, definition.note.presence || "Quepid cannot create a #{definition.label} index." unless definition.applicable?

      send("apply_#{definition.apply}", definition)
    rescue Faraday::Error => e
      raise Error, "Could not reach #{@endpoint.endpoint_url}: #{e.message}"
    end

    private

    def apply_elasticsearch definition
      response = client.put(path: "/#{definition.index_name}", body: definition.body.to_json)
      return if response.success?

      raise AlreadyExists, "The index #{definition.index_name} already exists on #{@endpoint.fullname}." if response.body.to_s.include?('resource_already_exists_exception')

      fail_with(response)
    end

    def apply_solr definition
      path = client.uri.path.to_s.sub(%r{/(select|query)\z}, '/schema')
      response = client.post(path: path, body: definition.body.to_json)
      body = JSON.parse(response.body.to_s) rescue {} # rubocop:disable Style/RescueModifier
      return if response.success? && body['error'].blank? && body['errors'].blank?
      raise Error, "There is no collection #{definition.index_name} on #{@endpoint.fullname}: Solr cannot make one from Quepid, so create it first." if 404 == response.status

      fail_with(response)
    end

    def apply_qdrant definition
      collection = definition.body['collection']
      response = client.put(path: "/collections/#{definition.index_name}", body: collection.to_json)
      raise AlreadyExists, "The collection #{definition.index_name} already exists on #{@endpoint.fullname}." if 409 == response.status

      fail_with(response) unless response.success?

      definition.body['payload_indexes'].each do |index|
        indexed = client.put(path: "/collections/#{definition.index_name}/index", body: index.to_json)
        fail_with(indexed) unless indexed.success?
      end
    end

    def fail_with response
      raise Error, "#{@endpoint.fullname} answered #{response.status}: #{response.body.to_s.squish.truncate(300)}"
    end

    def client
      @client ||= HttpClientService.new(@endpoint.endpoint_url, headers: headers, credentials: @endpoint.basic_auth_credential.presence)
    end

    def headers
      custom = @endpoint.custom_headers.is_a?(Hash) ? @endpoint.custom_headers : {}
      custom.merge('Content-Type' => 'application/json', 'Accept' => 'application/json')
    end
  end
end
