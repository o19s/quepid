# frozen_string_literal: true

require 'test_helper'

class QueryVectorStatusTest < ActiveSupport::TestCase
  let(:embedder) { embedders(:openai_small) }

  def meta_for embedder, text, overrides = {}
    {
      'embedder_id'   => embedder.id,
      'embedder_name' => embedder.name,
      'fingerprint'   => embedder.fingerprint,
      'text_digest'   => embedder.input_digest(text),
      'vectorized_at' => '2026-10-05T10:00:00Z',
    }.merge(overrides)
  end

  def status has_vector: true, meta: meta_for(embedder, 'star wars'), error: nil, embedder: self.embedder
    QueryVectorStatus.compute(embedder: embedder, query_text: 'star wars', has_vector: has_vector, meta: meta, error: error)
  end

  test 'none when the case has no embedder' do
    assert_equal 'none', status(embedder: nil).status
  end

  test 'pending without a vector' do
    result = status(has_vector: false, meta: nil)

    assert_equal 'pending', result.status
    assert_predicate result, :needs_work?
  end

  test 'current when everything matches' do
    result = status

    assert_equal 'current', result.status
    assert_nil result.reason
    assert_not result.needs_work?
  end

  test 'stale when made with another embedder, naming both' do
    result = status(meta: meta_for(embedder, 'star wars', 'embedder_id' => -1, 'embedder_name' => 'Old one'))

    assert_equal 'stale', result.status
    assert_equal 'Made with Old one; the case now uses OpenAI small', result.reason
  end

  test 'stale when the embedder settings changed' do
    result = status(meta: meta_for(embedder, 'star wars', 'fingerprint' => 'old'))

    assert_equal 'stale', result.status
    assert_match(/settings changed since this was vectorised \(2026-10-05T10:00:00Z\)/, result.reason)
  end

  test 'stale when the text that would be sent changed' do
    result = status(meta: meta_for(embedder, 'star wars', 'text_digest' => 'old'))

    assert_equal 'stale', result.status
  end

  test 'stale when there is a vector but no details' do
    assert_equal 'stale', status(meta: nil).status
  end

  test 'failed when the last attempt with these settings failed' do
    error = { 'message' => 'boom', 'fingerprint' => embedder.fingerprint, 'text_digest' => embedder.input_digest('star wars') }

    result = status(has_vector: false, meta: nil, error: error)

    assert_equal 'failed', result.status
    assert_equal 'Vectorisation failed: boom', result.reason
  end

  test 'an error from older settings does not count as failed' do
    error = { 'message' => 'boom', 'fingerprint' => 'old', 'text_digest' => embedder.input_digest('star wars') }

    assert_equal 'pending', status(has_vector: false, meta: nil, error: error).status
  end
end
