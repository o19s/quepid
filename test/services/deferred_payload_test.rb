# frozen_string_literal: true

require 'test_helper'

class DeferredPayloadTest < ActiveSupport::TestCase
  test 'payload round trips and remains available after a processing failure' do
    blob = DeferredPayload.stash!({ data: [ 'café', 1 ] }, filename: 'payload.bin.zip')
    assert_raises(RuntimeError) { DeferredPayload.consume(blob) { raise 'failed' } }
    assert_equal({ data: [ 'café', 1 ] }, DeferredPayload.load(blob))
    assert_equal :done, DeferredPayload.consume(blob) { :done }
    assert_not ActiveStorage::Blob.exists?(blob.id)
  ensure
    blob&.purge if blob && ActiveStorage::Blob.exists?(blob.id)
  end
end
