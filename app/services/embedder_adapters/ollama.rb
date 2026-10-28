# frozen_string_literal: true

module EmbedderAdapters
  # Ollama's native POST /api/embed, which takes a batch of inputs. (The older
  # /api/embeddings takes one prompt at a time.)
  class Ollama < Base
    private

    def path
      'api/embed'
    end

    # truncate: cut inputs longer than the model's context instead of failing the request.
    def request_body inputs
      body = { model: embedder.model, input: inputs, truncate: true }
      body[:dimensions] = requested_dimensions if requested_dimensions
      body
    end

    def parse response_body
      embeddings = response_body.is_a?(Hash) ? response_body['embeddings'] : nil
      raise Error, 'response has no "embeddings" array' unless embeddings.is_a?(Array)

      embeddings
    end
  end
end
