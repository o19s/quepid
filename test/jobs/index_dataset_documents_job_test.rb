# frozen_string_literal: true

require 'test_helper'

class IndexDatasetDocumentsJobTest < ActiveJob::TestCase
  let(:user) { users(:random) }

  setup do
    book = Book.create!(name: 'Docs', owner: user, scale: [ 0, 1 ])
    %w[d1 d2 d3].each { |id| QueryDocPair.create!(book: book, query_text: 'q', doc_id: id, document_fields: { 'name' => "Doc #{id}" }.to_json) }
    @link = CaseToDataset.create!(dataset: Dataset.for(user, 'haystack'), case: Case.create!(case_name: 'Haystack', owner: user, book: book), status: 'done')
    @es = SearchEndpoint.create!(owner: user, name: 'ES', search_engine: :es, api_method: 'POST', endpoint_url: 'http://es.example.com:9200/movies/_search')
    stub_request(:post, 'http://es.example.com:9200/movies/_refresh').to_return(status: 200, body: '{}')
  end

  test 'indexes the documents of the case and marks the link done, with how many' do
    stub = stub_request(:post, 'http://es.example.com:9200/_bulk').to_return(status: 200, body: { 'errors' => false, 'items' => Array.new(3) { { 'index' => { 'status' => 201 } } } }.to_json)

    IndexDatasetDocumentsJob.perform_now(@link, @es, 'movies')

    @link.reload

    assert_requested stub
    assert_equal [ 'done', 3, nil ], [ @link.indexing_status, @link.documents_indexed, @link.indexing_error ]
    assert_requested :post, 'http://es.example.com:9200/_bulk', body: ->(body) { body.include?('"title":"Doc d2"') && body.include?('"_id":"d3"') }
  end

  test 'marks the link failed, with the count and the reason, when the endpoint refuses some documents' do
    items = [ { 'index' => { 'status' => 201 } }, { 'index' => { 'status' => 400, 'error' => { 'type' => 'mapper_parsing_exception', 'reason' => 'bad' } } },
              { 'index' => { 'status' => 201 } } ]
    stub_request(:post, 'http://es.example.com:9200/_bulk').to_return(status: 200, body: { 'errors' => true, 'items' => items }.to_json)

    IndexDatasetDocumentsJob.perform_now(@link, @es, 'movies')

    @link.reload

    assert_equal [ 'failed', 2 ], [ @link.indexing_status, @link.documents_indexed ]
    assert_match(/1 of 3 documents were refused, the first because: mapper_parsing_exception: bad/, @link.indexing_error)
  end

  test 'records an endpoint that cannot be reached without raising, and an unexpected error with raising' do
    stub_request(:post, 'http://es.example.com:9200/_bulk').to_timeout

    assert_nothing_raised { IndexDatasetDocumentsJob.perform_now(@link, @es, 'movies') }
    assert_equal 'failed', @link.reload.indexing_status
    assert_match(/Could not reach/, @link.indexing_error)

    original = DatasetDocuments.method(:canonical)
    DatasetDocuments.define_singleton_method(:canonical) { |*| raise 'boom' }
    begin
      assert_raises(RuntimeError) { IndexDatasetDocumentsJob.perform_now(@link, @es, 'movies') }
    ensure
      DatasetDocuments.define_singleton_method(:canonical, original)
    end

    assert_equal 'boom', @link.reload.indexing_error
  end

  test 'runs on the bulk processing queue' do
    assert_equal 'bulk_processing', IndexDatasetDocumentsJob.new.queue_name
  end

  test 'indexes the WANDS products from their file, downloaded when needed, and marks the link done' do
    wands_link = CaseToDataset.create!(dataset: Dataset.for(user, 'wands'), case: Case.create!(case_name: 'WANDS', owner: user), status: 'done')
    directory = Pathname.new(Dir.mktmpdir('wands'))
    WandsData.directory = directory
    download = stub_request(:get, "#{WandsData::BASE_URL}/product.csv").to_return(status: 200, body: File.read(Rails.root.join('test/fixtures/files/wands/product.csv')))
    bulk = stub_request(:post, 'http://es.example.com:9200/_bulk').to_return(status: 200, body: { 'errors' => false, 'items' => Array.new(4) { { 'index' => { 'status' => 201 } } } }.to_json)

    IndexDatasetDocumentsJob.perform_now(wands_link, @es, 'movies')

    wands_link.reload

    assert_requested download, times: 1
    assert_requested bulk
    assert_equal [ 'done', 4 ], [ wands_link.indexing_status, wands_link.documents_indexed ]
    assert_requested :post, 'http://es.example.com:9200/_bulk',
                     body: ->(body) { body.include?('"title":"all-clad 7 qt . slow cooker"') && body.include?('"category":["Kitchen \u0026 Tabletop"') && body.include?('"rating":4.5') }
  ensure
    WandsData.directory = nil
    FileUtils.rm_rf(directory) if directory
  end

  test 'records a WANDS product file that cannot be downloaded on the link, without raising' do
    wands_link = CaseToDataset.create!(dataset: Dataset.for(user, 'wands'), case: Case.create!(case_name: 'WANDS', owner: user), status: 'done')
    directory = Pathname.new(Dir.mktmpdir('wands'))
    WandsData.directory = directory
    stub_request(:get, "#{WandsData::BASE_URL}/product.csv").to_return(status: 500, body: 'oops')

    assert_nothing_raised { IndexDatasetDocumentsJob.perform_now(wands_link, @es, 'movies') }

    assert_equal 'failed', wands_link.reload.indexing_status
    assert_match(/GitHub answered 500/, wands_link.indexing_error)
  ensure
    WandsData.directory = nil
    FileUtils.rm_rf(directory) if directory
  end
end
