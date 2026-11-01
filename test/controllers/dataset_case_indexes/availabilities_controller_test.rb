# frozen_string_literal: true

require 'test_helper'

module DatasetCaseIndexes
  class AvailabilitiesControllerTest < ActionDispatch::IntegrationTest
    let(:user) { users(:random) }

    # A book with documents, which is where Quepid has Haystack's.
    def give_documents
      @book = books(:book_of_star_wars_judgements)
      @case.update!(book: @book)
      @documents = DatasetDocuments.count(DatasetCatalog.find('haystack'), @case)
    end

    setup do
      login_user_for_integration_test user
      @case = Case.create!(case_name: 'Haystack case', owner: user)
      @link = CaseToDataset.create!(dataset: Dataset.for(user, 'haystack'), case: @case, status: 'done')
    end

    def make_endpoint engine, url, name: "My #{engine}", mapper: nil, owner: user
      SearchEndpoint.create!(owner: owner, name: name, search_engine: engine, mapper_based_search_engine_id: mapper, api_method: 'POST', endpoint_url: url)
    end

    test 'availability says whether the name is taken on the endpoints service, and only reads' do
      es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
      stub_request(:get, 'http://es.example.com:9200/wands').to_return(status: 404, body: '{}')
      stub_request(:get, 'http://es.example.com:9200/movies').to_return(status: 200, body: '{}')

      get dataset_case_index_availability_url(@link, search_endpoint_id: es.id, index_name: 'wands')

      assert_equal({ 'status' => 'free', 'message' => 'wands is free.' }, response.parsed_body)

      get dataset_case_index_availability_url(@link, search_endpoint_id: es.id, index_name: 'movies')

      assert_equal 'taken', response.parsed_body['status']
      assert_not_requested :put, /.*/
    end

    test 'availability refuses a bad name, and says when the service cannot answer' do
      es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
      get dataset_case_index_availability_url(@link, search_endpoint_id: es.id, index_name: 'UPPER')

      assert_equal 'invalid', response.parsed_body['status']

      stub_request(:get, 'http://es.example.com:9200/wands').to_return(status: 500, body: 'boom')
      get dataset_case_index_availability_url(@link, search_endpoint_id: es.id, index_name: 'wands')

      assert_equal 'unknown', response.parsed_body['status']
      assert_match(/answered 500/, response.parsed_body['message'])
    end

    test 'availability checks a Qdrant collection and a Solr core' do
      qdrant = make_endpoint(:qdrant, 'http://qd.example.com:6333', mapper: 'qdrant')
      stub_request(:get, 'http://qd.example.com:6333/collections/wands').to_return(status: 200, body: '{}')
      get dataset_case_index_availability_url(@link, search_endpoint_id: qdrant.id, index_name: 'wands')

      assert_equal 'taken', response.parsed_body['status']

      solr = make_endpoint(:solr, 'http://solr.example.com:8983/solr/shop/select')
      stub_request(:get, 'http://solr.example.com:8983/solr/admin/cores').with(query: hash_including('core' => 'wands'))
        .to_return(status: 200, body: '{"status":{"wands":{}}}')
      get dataset_case_index_availability_url(@link, search_endpoint_id: solr.id, index_name: 'wands')

      assert_equal 'free', response.parsed_body['status']
    end
  end
end
