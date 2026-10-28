# frozen_string_literal: true

module EmbedderAdapters
  # Voyage AI's POST /v1/embeddings. Same response shape as OpenAI, but it asks what the
  # text is for -- these are always search queries -- and names the size output_dimension.
  class Voyage < OpenAi
    private

    def request_body inputs
      body = { model: embedder.model, input: inputs, input_type: 'query' }
      body[:output_dimension] = requested_dimensions if requested_dimensions
      body
    end
  end
end
