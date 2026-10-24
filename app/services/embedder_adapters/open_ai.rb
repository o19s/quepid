# frozen_string_literal: true

module EmbedderAdapters
  # OpenAI's POST /v1/embeddings, also spoken by vLLM, TEI, LM Studio and LiteLLM.
  class OpenAi < Base
    private

    def path
      'v1/embeddings'
    end

    def request_body inputs
      body = { model: embedder.model, input: inputs }
      body[:dimensions] = requested_dimensions if requested_dimensions
      body
    end

    # `data` carries an `index` per item; sort on it rather than trusting the order.
    def parse response_body
      data = response_body.is_a?(Hash) ? response_body['data'] : nil
      raise Error, 'response has no "data" array' unless data.is_a?(Array)

      data.sort_by { |item| item['index'].to_i }.map { |item| item['embedding'] }
    end
  end
end
