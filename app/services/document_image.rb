# frozen_string_literal: true

require 'ipaddr'
require 'vips'

# A document's image, fetched and resized for a judge that is sent images as bytes rather
# than as a link (ADR 0009 D4, D5, D10). Never raises for an unusable image: `load` returns
# the image, or a short reason the judge's explanation can quote, or nothing when the
# document has no image at all.
#
#   image, skipped = DocumentImage.new(bounds: { min: 280, max: 1568 }, size: 300).load(fields)
class DocumentImage
  Image = Data.define(:bytes, :width, :height) do
    def mime_type = 'image/jpeg'
    def format = 'jpg'
    def base64 = [ bytes ].pack('m0')
  end

  MAX_BYTES = 16 * 1024 * 1024
  # Read from the header before any pixels are decoded, so a huge image is refused cheaply.
  MAX_PIXELS = 50_000_000
  DOWNLOAD_TIMEOUT = 10
  OPEN_TIMEOUT = 5
  JPEG_QUALITY = 85
  WHITE = [ 255, 255, 255 ].freeze
  DATA_URI = %r{\Adata:image/[\w.+-]+;base64,(.*)\z}m
  PNG_SIGNATURE = [ 0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A ].pack('C*')
  JPEG_SIGNATURE = [ 0xFF, 0xD8, 0xFF ].pack('C*')

  class Skipped < StandardError; end

  # @param bounds [Hash] the provider's { min:, max: } pixels per side
  # @param size [Integer] pixels for the shorter side
  def initialize bounds:, size:
    @bounds = bounds
    @size = size
  end

  # @return [Array(Image, nil)] the image, or [nil, reason], or [nil, nil] with no image to send
  def load document_fields
    source = source_in(document_fields)
    return [ nil, nil ] unless source

    [ resize(bytes_from(source)), nil ]
  rescue Skipped => e
    [ nil, e.message ]
  end

  private

  # `image` wins over `thumb`, as for the chat judges (Base#image_url_for); a data: URL counts here
  # because the bytes are already in hand.
  def source_in document_fields
    fields = document_fields.to_h
    [ fields['image'], fields['thumb'] ]
      .map { |value| value.to_s.strip }
      .find { |value| value.match?(%r{\Ahttps?://}i) || value.start_with?('data:image/') }
  end

  def bytes_from source
    return download(source) if source.match?(%r{\Ahttps?://}i)

    payload = source[DATA_URI, 1] or raise Skipped, 'the data: URL is not base64'
    payload.delete(" \n\r\t").unpack1('m0')
  rescue ArgumentError
    raise Skipped, 'the data: URL is not valid base64'
  end

  # shortcut: the host is resolved again when connecting, so DNS rebinding can slip past this
  # check, as it can for ProxyController; pin the checked address if that ever matters.
  def download url
    uri = URI.parse(url)
    allowlist = ProxyAllowlist.new
    addresses = Addrinfo.getaddrinfo(uri.hostname, nil, :UNSPEC, :STREAM).map { |info| IPAddr.new(info.ip_address) }
    raise Skipped, 'the image host is not allowed' if addresses.empty? || addresses.any? { |address| allowlist.blocked?(address, hostname: uri.hostname) }

    body = String.new(encoding: Encoding::BINARY)
    # Redirects are not followed (Faraday doesn't by default), so a public URL can't bounce inward.
    response = Faraday.get(url) do |request|
      request.options.timeout = DOWNLOAD_TIMEOUT
      request.options.open_timeout = OPEN_TIMEOUT
      request.options.on_data = proc do |chunk, received|
        raise Skipped, 'the image is larger than 16 MiB' if received > MAX_BYTES

        body << chunk
      end
    end
    raise Skipped, "the image download returned HTTP #{response.status}" unless response.success?

    body
  rescue Faraday::Error, SocketError, URI::InvalidURIError, IPAddr::InvalidAddressError
    raise Skipped, 'the image could not be downloaded'
  end

  # Always re-encoded as JPEG at the size asked for (up or down): that also converts WebP, GIF and
  # AVIF, uses an animation's first frame, and flattens transparency onto white.
  def resize bytes
    raise Skipped, 'it is not a PNG, JPEG, WebP, GIF or AVIF image' unless supported_format?(bytes)

    header = Vips::Image.new_from_buffer(bytes, '')
    width = header.width
    height = header.height
    raise Skipped, 'the image is too large to process' if width * height > MAX_PIXELS

    scale = @size.to_f / [ width, height ].min
    scale = @bounds[:max].to_f / [ width, height ].max if [ width, height ].max * scale > @bounds[:max]
    target_width = (width * scale).round
    target_height = (height * scale).round
    fits = [ target_width, target_height ].min >= @bounds[:min]
    raise Skipped, "it is too narrow or too wide to fit #{@bounds[:min]}-#{@bounds[:max]} px" unless fits

    image = Vips::Image.thumbnail_buffer(bytes, target_width, height: target_height, size: :both)
    image = image.flatten(background: WHITE) if image.has_alpha?
    image = image.colourspace(:srgb) unless :srgb == image.interpretation
    Image.new(bytes: image.jpegsave_buffer(Q: JPEG_QUALITY, keep: :none), width: image.width, height: image.height)
  rescue Vips::Error
    raise Skipped, 'the image could not be read'
  end

  # Checked from the bytes, never from a Content-Type or the data: URL's declared type. Anything
  # else (SVG above all, which would mean rendering untrusted XML) is never handed to libvips.
  def supported_format? bytes
    bytes.start_with?(PNG_SIGNATURE, JPEG_SIGNATURE, 'GIF87a', 'GIF89a') ||
      (bytes.start_with?('RIFF') && 'WEBP' == bytes.byteslice(8, 4)) ||
      ('ftyp' == bytes.byteslice(4, 4) && %w[avif avis].include?(bytes.byteslice(8, 4)))
  end
end
