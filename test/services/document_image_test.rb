# frozen_string_literal: true

require 'test_helper'

class DocumentImageTest < ActiveSupport::TestCase
  cover 'DocumentImage*'

  JEV = { min: 280, max: 1568, recommended: 300 }.freeze
  OPENAI = { min: 32, max: 2048, recommended: 768 }.freeze
  URL = 'http://198.51.100.10/product.png'

  def encoded width, height, suffix = '.png', bands: 3
    Vips::Image.black(width, height, bands: bands).write_to_buffer(suffix)
  end

  def serve body, url: URL, status: 200
    stub_request(:get, url).to_return(status: status, body: body)
  end

  def load fields, bounds: JEV, size: 300
    DocumentImage.new(bounds: bounds, size: size).load(fields)
  end

  def decoded image
    Vips::Image.new_from_buffer(image.bytes, '')
  end

  describe 'resizing' do
    test 'scales the shorter side to the size asked for, and re-encodes as JPEG' do
      serve encoded(600, 400)

      image, skipped = load({ 'image' => URL })

      assert_nil skipped
      assert_equal [ 450, 300 ], [ image.width, image.height ]
      assert image.bytes.start_with?(DocumentImage::JPEG_SIGNATURE)
      assert_equal 'image/jpeg', image.mime_type
      assert_equal [ 450, 300 ], [ decoded(image).width, decoded(image).height ]
    end

    test 'scales a small thumbnail up rather than skipping it' do
      serve encoded(150, 100)

      image, = load({ 'thumb' => URL })

      assert_equal [ 450, 300 ], [ image.width, image.height ]
    end

    test 'caps the longer side at the provider maximum' do
      serve encoded(4000, 1000)

      image, = load({ 'image' => URL }, size: 400)

      assert_equal [ 1568, 392 ], [ image.width, image.height ]
    end

    test 'skips an image too wide to fit the provider bounds' do
      serve encoded(4000, 400)

      image, skipped = load({ 'image' => URL })

      assert_nil image
      assert_equal 'it is too narrow or too wide to fit 280-1568 px', skipped
    end

    test 'the same banner fits a provider with wider bounds' do
      serve encoded(4000, 400)

      image, = load({ 'image' => URL }, bounds: OPENAI, size: 768)

      assert_equal [ 2048, 205 ], [ image.width, image.height ]
    end

    test 'converts WebP and GIF to JPEG' do
      %w[.webp .gif].each do |suffix|
        serve encoded(400, 400, suffix)

        image, skipped = load({ 'image' => URL })

        assert_nil skipped, suffix
        assert image.bytes.start_with?(DocumentImage::JPEG_SIGNATURE), "#{suffix} became JPEG"
      end
    end

    test 'flattens transparency onto white' do
      serve encoded(400, 400, bands: 4)

      image, = load({ 'image' => URL })

      assert_equal 3, decoded(image).bands
      assert_operator decoded(image).getpoint(10, 10).min, :>, 250, 'transparent pixels become white, not black'
    end

    test 'shrinks a large photo without capping it' do
      serve encoded(2000, 1000)

      image, = load({ 'image' => URL })

      assert_equal [ 600, 300 ], [ image.width, image.height ]
    end

    test 'measures the shorter side of a portrait image too' do
      serve encoded(400, 600)

      image, = load({ 'image' => URL })

      assert_equal [ 300, 450 ], [ image.width, image.height ]
    end

    test 'accepts an image that lands exactly on the provider minimum' do
      serve encoded(560, 400)

      image, skipped = load({ 'image' => URL }, size: 280)

      assert_nil skipped
      assert_equal [ 392, 280 ], [ image.width, image.height ]
    end

    test 'accepts JPEG and the older GIF87a header' do
      gif87 = encoded(400, 400, '.gif').sub('GIF89a', 'GIF87a')
      [ encoded(400, 400, '.jpg'), gif87 ].each do |body|
        serve body

        image, skipped = load({ 'image' => URL })

        assert_nil skipped, body.byteslice(0, 6).inspect
        assert_equal [ 300, 300 ], [ image.width, image.height ]
      end
    end

    test 'lets AVIF through to libvips, by its ftyp brand' do
      # libvips here can't write AVIF, so a bare AVIF header stands in: it passes the format
      # check and then fails to decode, which is a different reason from an unknown format.
      serve "#{[ 0, 0, 0, 28 ].pack('C*')}ftypavif#{([ 0 ] * 32).pack('C*')}"

      assert_equal [ nil, 'the image could not be read' ], load({ 'image' => URL })
    end

    test 'skips an image too large to decode, from its header alone' do
      serve encoded(10_000, 5_001)

      image, skipped = load({ 'image' => URL })

      assert_nil image
      assert_equal 'the image is too large to process', skipped
    end
  end

  describe 'where the image comes from' do
    test 'prefers image over thumb, and needs an absolute URL' do
      serve encoded(300, 300), url: 'http://198.51.100.10/thumb.png'

      image, = load({ 'image' => '/relative.png', 'thumb' => 'http://198.51.100.10/thumb.png' })

      assert image
    end

    test 'nothing to send and nothing to say when the document has no usable image' do
      assert_equal [ nil, nil ], load({ 'title' => 'No image' })
      assert_equal [ nil, nil ], load({ 'image' => '/relative.png' })
    end

    test 'uses a base64 data: URL without downloading anything' do
      data = "data:image/png;base64,#{[ encoded(300, 300) ].pack('m0')}"

      image, skipped = load({ 'image' => data })

      assert_nil skipped
      assert_equal [ 300, 300 ], [ image.width, image.height ]
    end

    test 'takes a data: URL whose base64 is split over lines' do
      payload = [ encoded(300, 300) ].pack('m0').scan(/.{1,76}/).join("\n")

      image, skipped = load({ 'image' => "data:image/png;base64,#{payload}" })

      assert_nil skipped
      assert image
    end

    test 'skips a data: URL that is not base64 at all' do
      assert_equal [ nil, 'the data: URL is not base64' ], load({ 'image' => 'data:image/png,rawbytes' })
    end

    test 'takes a URL with an upper-case scheme or stray spaces around it' do
      serve encoded(300, 300)

      [ ' http://198.51.100.10/product.png ', 'HTTP://198.51.100.10/product.png' ].each do |value|
        image, skipped = load({ 'image' => value })

        assert_nil skipped, value.inspect
        assert_instance_of DocumentImage::Image, image
      end
    end

    test 'skips a data: URL that is not valid base64' do
      assert_equal [ nil, 'the data: URL is not valid base64' ], load({ 'image' => 'data:image/png;base64,***' })
    end

    test 'never renders SVG, whatever the URL or data: type says' do
      svg = '<svg xmlns="http://www.w3.org/2000/svg" width="400" height="400"></svg>'
      serve svg

      assert_equal [ nil, 'it is not a PNG, JPEG, WebP, GIF or AVIF image' ], load({ 'image' => URL })
      assert_equal [ nil, 'it is not a PNG, JPEG, WebP, GIF or AVIF image' ],
                   load({ 'image' => "data:image/png;base64,#{[ svg ].pack('m0')}" })
    end

    test 'a RIFF file that is not WebP is refused' do
      serve "RIFF#{[ 36 ].pack('V')}WAVEfmt #{([ 0 ] * 32).pack('C*')}"

      assert_equal [ nil, 'it is not a PNG, JPEG, WebP, GIF or AVIF image' ], load({ 'image' => URL })
    end
  end

  describe 'downloading' do
    test 'skips a failed download, a redirect included' do
      [ 404, 302 ].each do |status|
        serve '', status: status

        assert_equal [ nil, "the image download returned HTTP #{status}" ], load({ 'image' => URL })
      end
    end

    test 'waits the timeout it is given, and connects within at most 5 seconds of it' do
      assert_equal({ timeout: 30, open_timeout: 5 }, DocumentImage.new(bounds: JEV, size: 300, timeout: 30).send(:timeouts))
      assert_equal({ timeout: 2, open_timeout: 2 }, DocumentImage.new(bounds: JEV, size: 300, timeout: 2).send(:timeouts))
      assert_equal({ timeout: 0.3, open_timeout: 0.3 }, DocumentImage.new(bounds: JEV, size: 300).send(:timeouts))
    end

    test 'skips a download that fails to connect' do
      stub_request(:get, URL).to_timeout

      assert_equal [ nil, 'the image could not be downloaded' ], load({ 'image' => URL })
    end

    test 'never reaches a loopback, link-local or private address' do
      %w[http://127.0.0.1/a.png http://169.254.169.254/latest http://10.0.0.1/a.png].each do |url|
        assert_equal [ nil, 'the image host is not allowed' ], load({ 'image' => url }), url
      end
      assert_not_requested :get, /.*/
    end

    test 'refuses a host that resolves to no address at all' do
      original = Addrinfo.method(:getaddrinfo)
      Addrinfo.define_singleton_method(:getaddrinfo) { |*| [] }

      assert_equal [ nil, 'the image host is not allowed' ], load({ 'image' => URL })
      assert_not_requested :get, URL
    ensure
      Addrinfo.define_singleton_method(:getaddrinfo, &original)
    end

    test 'stops reading at 16 MiB' do
      serve 'x' * (DocumentImage::MAX_BYTES + 1)

      assert_equal [ nil, 'the image is larger than 16 MiB' ], load({ 'image' => URL })
    end
  end
end
