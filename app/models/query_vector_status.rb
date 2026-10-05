# frozen_string_literal: true

# Whether a query's stored vector is the one its case's embedder would produce now.
#
# The single place the rules live: the case page badges, the status endpoint the page
# polls, and VectorizeCaseQueriesJob (which redoes exactly the queries that need it) all
# go through here. It compares what was recorded next to the vector in the query's
# options (`query_vec_meta`, or `query_vec_error` after a failed attempt) with the
# embedder's current fingerprint and the text that would be sent now -- no API call.
class QueryVectorStatus
  NONE    = 'none'
  PENDING = 'pending'
  STALE   = 'stale'
  FAILED  = 'failed'
  CURRENT = 'current'

  # The statuses VectorizeCaseQueriesJob works on.
  NEEDS_WORK = [ PENDING, STALE, FAILED ].freeze

  attr_reader :status, :reason

  # @param embedder [Embedder, nil] the case's embedder
  # @param query_text [String]
  # @param has_vector [Boolean] whether options carry a query_vec
  # @param meta [Hash, nil] options['query_vec_meta']
  # @param error [Hash, nil] options['query_vec_error']
  def self.compute embedder:, query_text:, has_vector:, meta:, error:
    return new(NONE, nil) if embedder.nil?

    fingerprint = embedder.fingerprint
    digest = embedder.input_digest(query_text)

    return new(FAILED, "Vectorisation failed: #{error['message']}") if error.is_a?(Hash) && error['fingerprint'] == fingerprint && error['text_digest'] == digest
    return new(PENDING, "Waiting to be vectorised with #{embedder.name}") unless has_vector

    stale_reason = stale_reason(embedder, meta, fingerprint, digest)
    stale_reason ? new(STALE, stale_reason) : new(CURRENT, nil)
  end

  def self.stale_reason embedder, meta, fingerprint, digest
    return 'The vector has no vectorisation details, so it may not match the embedder' unless meta.is_a?(Hash)

    return "Made with #{meta['embedder_name'] || 'another embedder'}; the case now uses #{embedder.name}" if meta['embedder_id'] != embedder.id
    return "#{embedder.name}'s settings changed since this was vectorised#{at(meta)}" if meta['fingerprint'] != fingerprint
    return 'The text to vectorise changed (query text or input template)' if meta['text_digest'] != digest

    nil
  end
  private_class_method :stale_reason

  def self.at meta
    meta['vectorized_at'].present? ? " (#{meta['vectorized_at']})" : ''
  end
  private_class_method :at

  def initialize status, reason
    @status = status
    @reason = reason
  end

  def needs_work?
    NEEDS_WORK.include?(status)
  end

  def as_json(*)
    { status: status, reason: reason }
  end
end
