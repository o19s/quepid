# frozen_string_literal: true

module EmbedderAdapters
  # Cohere's POST /v2/embed. Inputs go in `texts` (at most 96 a request), Cohere asks what
  # they are for -- these are always search queries -- and the vectors come back under
  # embeddings.float, in input order.
  class Cohere < Base
    private

    def path
      'v2/embed'
    end

    def request_body inputs
      body = { model: embedder.model, texts: inputs, input_type: 'search_query', embedding_types: [ 'float' ] }
      body[:output_dimension] = requested_dimensions if requested_dimensions
      body
    end

    def parse response_body
      vectors = response_body.is_a?(Hash) ? response_body.dig('embeddings', 'float') : nil
      raise Error, 'response has no "embeddings.float" array' unless vectors.is_a?(Array)

      vectors
    end
  end
end
