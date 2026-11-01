# frozen_string_literal: true

module DatasetIndex
  # Sends documents (in the canonical shape) to the index of a search endpoint, for the engines Quepid knows how to
  # load: Elasticsearch and OpenSearch (the bulk API), Solr (the update handler) and Vespa (its Document API, one
  # document at a time, into a schema the user has deployed). Qdrant is not here: its points need a vector each, which
  # means embedding every document. Nor are Algolia and Vectara.
  class Indexer
    BATCH_SIZE = 500
    ENGINES = { 'es' => :bulk, 'os' => :bulk, 'solr' => :solr, 'vespa' => :vespa }.freeze
    VESPA_NAMESPACE = 'quepid'

    # How many were indexed, how many the engine refused, and why the first was.
    Result = Struct.new(:indexed, :failed, :first_error)

    def self.supports? engine_id
      ENGINES.key?(engine_id)
    end

    def initialize endpoint, index_name
      @endpoint = endpoint
      @index_name = index_name
      @engine = ENGINES[DatasetIndex.engine_id(endpoint)] || raise(Unsupported, "Quepid cannot load documents into #{SearchEngine.label(endpoint.search_engine)}.")
    end

    # Calls the block with the number indexed so far after each batch.
    def index documents
      result = Result.new(0, 0, nil)
      documents.each_slice(batch_size) do |batch|
        send("index_#{@engine}", batch, result)
        yield result.indexed if block_given?
      end
      refresh if :bulk == @engine
      result
    rescue Faraday::Error => e
      raise Error, "Could not reach #{@endpoint.endpoint_url}: #{e.message}"
    end

    private

    def index_bulk batch, result
      lines = batch.flat_map { |doc| [ { 'index' => { '_index' => @index_name, '_id' => doc['id'] } }.to_json, doc.to_json ] }
      response = client('application/x-ndjson').post(path: '/_bulk', body: "#{lines.join("\n")}\n")
      fail_with(response) unless response.success?

      items = JSON.parse(response.body.to_s)['items'] || []
      refused = items.reject { |item| item.values.first['status'].to_i.between?(200, 299) }
      result.indexed += batch.size - refused.size
      result.failed += refused.size
      result.first_error ||= reason(refused.first.values.first['error']) if refused.any?
    end

    # One request per document, which Vespa's Document API takes: a put of the fields, under the document's id.
    def index_vespa batch, result
      batch.each do |doc|
        response = client.post(path: "/document/v1/#{VESPA_NAMESPACE}/#{@index_name}/docid/#{ERB::Util.url_encode(doc['id'])}",
                               body: { 'fields' => doc }.to_json)
        if response.success?
          result.indexed += 1
        else
          result.failed += 1
          result.first_error ||= "#{response.status}: #{response.body.to_s.squish.truncate(200)}"
        end
      end
    end

    # Vespa takes documents one by one, so report progress more often.
    def batch_size
      :vespa == @engine ? 100 : BATCH_SIZE
    end

    def index_solr batch, result
      path = client.uri.path.to_s.sub(%r{/(select|query)\z}, '/update')
      response = client.post(path: path, params: { 'commit' => 'true' }, body: batch.to_json)
      fail_with(response) unless response.success?

      result.indexed += batch.size
    end

    def refresh
      client.post(path: "/#{@index_name}/_refresh")
    end

    def reason error
      error.is_a?(Hash) ? [ error['type'], error['reason'] ].compact.join(': ') : error.to_s
    end

    def fail_with response
      raise Error, "#{@endpoint.fullname} answered #{response.status}: #{response.body.to_s.squish.truncate(300)}"
    end

    def client content_type = 'application/json'
      @clients ||= {}
      @clients[content_type] ||= HttpClientService.new(@endpoint.endpoint_url, headers:     headers.merge('Content-Type' => content_type),
                                                                               credentials: @endpoint.basic_auth_credential.presence)
    end

    def headers
      custom = @endpoint.custom_headers.is_a?(Hash) ? @endpoint.custom_headers : {}
      custom.merge('Accept' => 'application/json')
    end
  end
end
