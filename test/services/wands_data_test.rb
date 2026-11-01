# frozen_string_literal: true

require 'test_helper'

class WandsDataTest < ActiveSupport::TestCase
  FIXTURES = Rails.root.join('test/fixtures/files/wands')

  setup do
    @directory = Pathname.new(Dir.mktmpdir('wands'))
    WandsData.directory = @directory
  end

  teardown do
    WandsData.directory = nil
    FileUtils.rm_rf(@directory)
  end

  def stub_file name, status: 200, body: nil
    stub_request(:get, "#{WandsData::BASE_URL}/#{WandsData::FILES.fetch(name).first}")
      .to_return(status: status, body: body || File.read(FIXTURES.join(WandsData::FILES.fetch(name).first)))
  end

  test 'downloads the files asked for, and only those' do
    query = stub_file(:query)
    label = stub_file(:label)
    product = stub_file(:product)

    WandsData.fetch!(:query, :label)

    assert_requested query
    assert_requested label
    assert_not_requested product
    assert_predicate WandsData.path(:query), :exist?
    assert_not_predicate WandsData.path(:product), :exist?
  end

  test 'keeps what it downloaded, so a file is fetched once' do
    query = stub_file(:query)

    2.times { WandsData.fetch!(:query) }
    WandsData.each_row(:query) { |_| nil }

    assert_requested query, times: 1
  end

  test 'reads a file as rows of header => value, tab separated' do
    stub_file(:product)
    rows = []
    WandsData.each_row(:product) { |row| rows << row }

    assert_equal 4, rows.size
    assert_equal [ 'product_id', 'product_name', 'product_class', 'category hierarchy', 'product_description', 'product_features', 'rating_count', 'average_rating', 'review_count' ], rows.first.keys
    assert_equal [ 'solid wood platform bed', 'Beds', '4.5' ], rows.first.values_at('product_name', 'product_class', 'average_rating')
    assert_equal '', rows[3]['product_description'].to_s
  end

  test 'does not mistake a quote character in a description for the start of a quoted field' do
    body = "product_id\tproduct_name\tproduct_class\tcategory hierarchy\tproduct_description\tproduct_features\trating_count\taverage_rating\treview_count\n" \
           "7\ta 5\" nail\tNails\tHardware\tfive\" long , \"sharp\"\t\t1.0\t3.0\t1.0\n8\tnext\tNails\tHardware\tok\t\t1.0\t3.0\t1.0\n"
    stub_file(:product, body: body)
    rows = []
    WandsData.each_row(:product) { |row| rows << row }

    assert_equal [ 'a 5" nail', 'next' ], rows.pluck('product_name')
    assert_equal 'five" long , "sharp"', rows.first['product_description']
  end

  test 'reads a quoted field as WANDS writes it, with its doubled quotes made single' do
    # Two rows exactly as upstream's query.csv has them.
    body = "query_id\tquery\tquery_class\n208\t\"fawkes 36\"\" blue vanity\"\tVanities\n391\t\"writing desk 48\"\"\"\tDesks\n"
    stub_file(:query, body: body)
    rows = []
    WandsData.each_row(:query) { |row| rows << row }

    assert_equal [ 'fawkes 36" blue vanity', 'writing desk 48"' ], rows.pluck('query')
    assert_equal %w[Vanities Desks], rows.pluck('query_class')
  end

  test 'refuses a file that does not start with the columns WANDS has, and keeps nothing of it' do
    stub_file(:label, body: "a\tb\tc\n1\t2\t3\n")

    error = assert_raises(WandsData::Error) { WandsData.fetch!(:label) }

    assert_match(/label\.csv does not start with the columns/, error.message)
    assert_not_predicate WandsData.path(:label), :exist?
    assert_empty Dir.children(@directory).grep(/\.part\z/)
  end

  test 'reports what GitHub answered when it does not hand the file over' do
    stub_file(:query, status: 404, body: 'Not Found')

    error = assert_raises(WandsData::Error) { WandsData.fetch!(:query) }

    assert_match(/GitHub answered 404/, error.message)
    assert_not_predicate WandsData.path(:query), :exist?
    assert_empty Dir.children(@directory).grep(/\.part\z/)
  end

  test 'reports a download that cannot be made' do
    stub_request(:get, "#{WandsData::BASE_URL}/query.csv").to_timeout

    assert_match(/Could not download/, assert_raises(WandsData::Error) { WandsData.fetch!(:query) }.message)

    stub_request(:get, "#{WandsData::BASE_URL}/query.csv").to_raise(SocketError.new('getaddrinfo failed'))

    assert_match(/Could not download .*getaddrinfo failed/, assert_raises(WandsData::Error) { WandsData.fetch!(:query) }.message)
  end

  test 'tries again after a failure, because nothing half-written was kept' do
    stub_file(:query, status: 500, body: 'oops')
    assert_raises(WandsData::Error) { WandsData.fetch!(:query) }

    stub_file(:query)
    WandsData.fetch!(:query)

    assert_predicate WandsData.path(:query), :exist?
  end

  test 'downloads from the Wayfair repository, over https' do
    assert_equal 'https://raw.githubusercontent.com/wayfair/WANDS/main/dataset', WandsData::BASE_URL
    assert_equal [ :query, :product, :label ], WandsData::FILES.keys
  end
end
