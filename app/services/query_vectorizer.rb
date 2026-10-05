# frozen_string_literal: true

# Turns queries into vectors with one embedder and stores the result in each query's
# options: `query_vec` (what search templates read as #$qOption.query_vec##) plus
# `query_vec_meta`, a readable record of how it was made -- which embedder, provider,
# model, size, the embedder's fingerprint and a digest of the exact text sent -- so
# QueryVectorStatus can later tell whether it still matches.
#
# Works batch by batch: a batch the provider rejects gets `query_vec_error` on each of
# its queries (keeping any older vector), and the remaining batches still run.
class QueryVectorizer
  # Plenty for the relative comparisons vector search does, and keeps the JSON stored
  # in options (and sent to the case page) from carrying 17-digit floats.
  PRECISION = 7

  Result = Struct.new(:vectorized, :failed, :errors, keyword_init: true)

  # @param embedder [Embedder]
  # @param timeout [Integer, nil] seconds per request; defaults to the embedder's own
  def initialize embedder, timeout: nil
    @embedder = embedder
    @timeout = timeout
  end

  # @param queries [Enumerable<Query>]
  # @yieldparam done [Integer] queries processed so far, after each batch
  # @return [Result]
  def vectorize queries
    result = Result.new(vectorized: 0, failed: 0, errors: [])
    queries = queries.to_a
    fingerprint = @embedder.fingerprint

    queries.each_slice(@embedder.provider_definition.max_batch_size) do |batch|
      vectorize_batch(batch, fingerprint, result)
      yield(result.vectorized + result.failed) if block_given?
    end

    result
  end

  private

  def vectorize_batch batch, fingerprint, result
    vectors = @embedder.embed(batch.map(&:query_text), timeout: @timeout)
    batch.zip(vectors) do |query, vector|
      query.write_vector_options(
        'query_vec'       => vector.map { |value| value.round(PRECISION) },
        'query_vec_meta'  => meta_for(query, vector, fingerprint),
        'query_vec_error' => nil
      )
    end
    result.vectorized += batch.size
  rescue EmbedderAdapters::Error => e
    batch.each do |query|
      query.write_vector_options('query_vec_error' => {
        'message'     => e.message,
        'fingerprint' => fingerprint,
        'text_digest' => @embedder.input_digest(query.query_text),
        'at'          => Time.current.utc.iso8601,
      })
    end
    result.failed += batch.size
    result.errors << e.message
  end

  def meta_for query, vector, fingerprint
    {
      'embedder_id'   => @embedder.id,
      'embedder_name' => @embedder.name,
      'provider'      => @embedder.provider,
      'model'         => @embedder.model,
      'dimensions'    => vector.size,
      'truncation'    => @embedder.truncation,
      'fingerprint'   => fingerprint,
      'text_digest'   => @embedder.input_digest(query.query_text),
      'vectorized_at' => Time.current.utc.iso8601,
    }
  end
end
