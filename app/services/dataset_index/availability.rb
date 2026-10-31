# frozen_string_literal: true

module DatasetIndex
  # Asks a search endpoint's service whether an index (or collection) of this name is already there, so the user can
  # pick a free name for a new one. Only reads: Elasticsearch and OpenSearch, Solr and Qdrant.
  class Availability
    ENGINES = %w[es os solr qdrant].freeze

    def self.supports? endpoint
      ENGINES.include?(DatasetIndex.engine_id(endpoint))
    end

    def initialize endpoint
      @endpoint = endpoint
    end

    # true when the name is taken, false when it is free. Raises Error when the service could not say.
    def taken? name
      case DatasetIndex.engine_id(@endpoint)
      when 'solr' then solr_taken?(name)
      when 'qdrant' then exists?("/collections/#{name}")
      else exists?("/#{name}")
      end
    rescue Faraday::Error => e
      raise Error, "Could not reach #{@endpoint.endpoint_url}: #{e.message}"
    end

    # What the browser needs to ask the service itself, for an endpoint whose searches do not go through Quepid's proxy:
    # the service's own origin, its engine, and the headers to send. Same reach as the case's searches have. The origin
    # leaves out any user:password in the endpoint's URL, so those go in the Authorization header, as HttpClientService
    # does: the endpoint's credential first, else the URL's.
    def self.browser_probe endpoint
      uri = Addressable::URI.parse(endpoint.endpoint_url)
      headers = endpoint.custom_headers.is_a?(Hash) ? endpoint.custom_headers.dup : {}
      credentials = endpoint.basic_auth_credential.presence || uri.userinfo.presence&.then { |userinfo| Addressable::URI.unencode_component(userinfo) }
      headers['Authorization'] = "Basic #{Base64.strict_encode64(credentials)}" if credentials
      { origin: "#{uri.scheme}://#{uri.authority.to_s.split('@').last}", engine: DatasetIndex.engine_id(endpoint), path: uri.path.to_s, headers: headers }
    end

    private

    def exists? path
      response = client.get(path: path)
      return true if response.success?
      return false if 404 == response.status

      raise Error, "#{@endpoint.fullname} answered #{response.status}: #{response.body.to_s.squish.truncate(200)}"
    end

    def solr_taken? name
      response = client.get(path: '/solr/admin/cores', params: { action: 'STATUS', core: name, wt: 'json' })
      raise Error, "#{@endpoint.fullname} answered #{response.status}" unless response.success?

      JSON.parse(response.body.to_s).dig('status', name).present?
    rescue JSON::ParserError
      raise Error, "#{@endpoint.fullname} did not answer with JSON"
    end

    def client
      @client ||= HttpClientService.new(@endpoint.endpoint_url, headers: headers, credentials: @endpoint.basic_auth_credential.presence)
    end

    def headers
      custom = @endpoint.custom_headers.is_a?(Hash) ? @endpoint.custom_headers : {}
      custom.merge('Accept' => 'application/json')
    end
  end
end
