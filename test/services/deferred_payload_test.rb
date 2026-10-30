# frozen_string_literal: true

require 'test_helper'

class DeferredPayloadTest < ActiveSupport::TestCase
  cover 'DeferredPayload*'

  test 'payload round trips and remains available after a processing failure' do
    blob = DeferredPayload.stash!({ data: [ 'café', 1 ] }, filename: 'payload.bin.zip')
    assert_raises(RuntimeError) { DeferredPayload.consume(blob) { raise 'failed' } }
    assert_equal({ data: [ 'café', 1 ] }, DeferredPayload.load(blob))
    assert_equal :done, DeferredPayload.consume(blob) { :done }
    assert_not ActiveStorage::Blob.exists?(blob.id)
  ensure
    blob&.purge if blob && ActiveStorage::Blob.exists?(blob.id)
  end

  test 'consume yields the stashed payload' do
    blob = DeferredPayload.stash!({ data: [ 'café', 1 ] }, filename: 'payload.bin.zip')

    assert_equal({ data: [ 'café', 1 ] }, DeferredPayload.consume(blob) { |payload| payload })
  ensure
    blob&.purge if blob && ActiveStorage::Blob.exists?(blob.id)
  end

  test 'stash! names the blob and attaches it only when asked' do
    book = books(:james_bond_movies)
    loose = DeferredPayload.stash!({ a: 1 }, filename: 'loose.bin.zip')
    attached = DeferredPayload.stash!({ a: 2 }, filename: 'attached.bin.zip', attachment: book.import_file)

    assert_equal 'loose.bin.zip', loose.filename.to_s
    assert_equal attached, book.reload.import_file.blob
    assert_not_equal loose, book.import_file.blob
  ensure
    [ loose, attached ].each { |blob| blob.purge if blob && ActiveStorage::Blob.exists?(blob.id) }
  end
end
