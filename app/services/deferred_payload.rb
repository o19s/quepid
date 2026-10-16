# frozen_string_literal: true

# Internal, server-generated payloads only. Keep the blob until processing succeeds,
# so ActiveJob retries can read the same payload after a failure.
module DeferredPayload
  def self.stash! payload, filename:, attachment: nil
    blob = ActiveStorage::Blob.create_and_upload!(
      io:           StringIO.new(Zlib::Deflate.deflate(Marshal.dump(payload))),
      filename:     filename,
      content_type: 'application/zip'
    )
    attachment&.attach(blob)
    blob
  end

  def self.load blob
    # rubocop:disable-next Security/MarshalLoad
    Marshal.load(Zlib::Inflate.inflate(blob.download))
  end

  def self.consume blob
    result = yield load(blob)
    blob.purge
    result
  end
end
