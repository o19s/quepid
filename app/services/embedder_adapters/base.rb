# frozen_string_literal: true

module EmbedderAdapters
  # Turns texts into vectors for one Embedder. Subclasses implement #path, #request_body
  # and #parse; everything else -- rendering the input template, splitting into batches,
  # client-side truncation and checking what came back -- happens here, so every provider
  # behaves the same way around the one part that differs.
  class Base
    attr_reader :embedder

    def initialize embedder
      @embedder = embedder
    end

    # @param texts [Array<String>] raw query texts; the input template is applied here
    # @param timeout [Integer, nil] seconds per request, overriding the embedder's own
    #   (a web request vectorising one new query can't wait as long as a background job)
    # @return [Array<Array<Float>>] one vector per text, in the same order
    def embed texts, timeout: nil
      return [] if texts.empty?

      @timeout = timeout || embedder.timeout

      inputs = texts.map { |text| embedder.render_input(text) }
      vectors = inputs.each_slice(batch_size).flat_map { |batch| embed_batch(batch) }
      vectors = vectors.map { |vector| truncate(vector) } if 'client' == embedder.truncation
      check_dimensions(vectors)
      vectors
    end

    private

    # @return [String] path relative to the embedder's service_url (no leading slash, so a
    #   base URL with a path prefix keeps it)
    def path
      raise NotImplementedError
    end

    # @param inputs [Array<String>] already-rendered texts, at most batch_size of them
    def request_body inputs
      raise NotImplementedError
    end

    # @return [Array<Array<Float>>] vectors in input order
    def parse response_body
      raise NotImplementedError
    end

    # Size to ask the provider for, or nil to take the model's default. Client-side
    # truncation asks for the full vector and cuts it down afterwards.
    def requested_dimensions
      'native' == embedder.truncation ? embedder.dimensions : nil
    end

    def batch_size
      embedder.provider_definition.max_batch_size
    end

    def embed_batch inputs
      vectors = parse(post(request_body(inputs)))
      unless vectors.is_a?(Array) && vectors.size == inputs.size
        raise Error, "expected #{inputs.size} embeddings, got #{vectors.is_a?(Array) ? vectors.size : 'none'}"
      end

      vectors.map { |vector| vector.map(&:to_f) }
    end

    def post body
      response = connection.post(path) do |req|
        req.headers.merge!(headers)
        req.options.timeout = (@timeout || embedder.timeout).to_i
        req.body = body
      end

      raise Error, "#{embedder.provider_definition.label} API error: #{response.status} - #{error_detail(response.body)}" unless response.success?

      response.body.is_a?(String) ? JSON.parse(response.body) : response.body
    rescue Faraday::Error => e
      raise Error, "#{embedder.provider_definition.label} request failed: #{e.message}"
    rescue JSON::ParserError
      raise Error, "#{embedder.provider_definition.label} returned a response that is not JSON"
    end

    def connection
      LlmConnection.build(url: embedder.service_url)
    end

    def headers
      return {} if embedder.api_key.blank? || :none == embedder.provider_definition.auth_style

      { 'Authorization' => "Bearer #{embedder.api_key}" }
    end

    def error_detail body
      body.is_a?(Hash) ? (body.dig('error', 'message') || body['error'] || body['message'] || body['detail'] || body).to_s : body.to_s
    end

    # Matryoshka-style truncation: keep the leading components, then rescale to unit length
    # so cosine and dot-product scores stay comparable.
    def truncate vector
      cut = vector.first(embedder.dimensions)
      norm = Math.sqrt(cut.sum { |value| value * value })
      norm.zero? ? cut : cut.map { |value| value / norm }
    end

    def check_dimensions vectors
      lengths = vectors.map(&:size).uniq
      raise Error, "embeddings have different lengths: #{lengths.join(', ')}" if lengths.size > 1

      expected = embedder.dimensions
      return if expected.nil? || lengths.empty? || lengths.first == expected

      raise Error, "expected #{expected} dimensions, got #{lengths.first}"
    end
  end
end
