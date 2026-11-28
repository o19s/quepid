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
  end

  describe 'downloading' do
    test 'skips a failed download, a redirect included' do
      [ 404, 302 ].each do |status|
        serve '', status: status

        assert_equal [ nil, "the image download returned HTTP #{status}" ], load({ 'image' => URL })
      end
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

    test 'stops reading at 16 MiB' do
      serve 'x' * (DocumentImage::MAX_BYTES + 1)

      assert_equal [ nil, 'the image is larger than 16 MiB' ], load({ 'image' => URL })
    end
  end
end
