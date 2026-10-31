# frozen_string_literal: true

require 'test_helper'

module DatasetCaseIndexes
  class ValidationsControllerTest < ActionDispatch::IntegrationTest
    let(:user) { users(:random) }

    setup do
      login_user_for_integration_test user
      @case = Case.create!(case_name: 'Haystack case', owner: user)
      @link = CaseToDataset.create!(dataset: Dataset.for(user, 'haystack'), case: @case, status: 'done')
    end

    def make_endpoint engine, url, name: "My #{engine}"
      SearchEndpoint.create!(owner: user, name: name, search_engine: engine, api_method: 'POST', endpoint_url: url)
    end

    def validate endpoint, **params
      post dataset_case_index_validation_url(@link), params: { search_endpoint_id: endpoint.id, **params }, as: :json
    end

    test 'takes a definition create would take, and sends nothing anywhere' do
      solr = make_endpoint(:solr, 'http://solr.example.com:8983/solr/shop/select')

      assert_no_difference [ 'SearchEndpoint.count', 'Try.count' ] do
        validate solr, index_name: 'shop', definition: DatasetIndex::Solr.commands.to_json
      end

      assert_response :no_content
      assert_not_requested :any, /.*/
      assert_nil @link.reload.index_name
    end

    test 'refuses what create would refuse, with the reason' do
      solr = make_endpoint(:solr, 'http://solr.example.com:8983/solr/shop/select')
      es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')

      validate solr, index_name: 'shop', definition: '{"delete-field": {"name": "title"}}'

      assert_response :unprocessable_content
      assert_match(/only sends add commands to Solr.*not delete-field/, response.parsed_body['error'])

      validate es, index_name: '../x', definition: '{"settings":{}}'

      assert_match(/is not a name Elasticsearch accepts/, response.parsed_body['error'])

      validate es, index_name: 'movies', definition: 'not json'

      assert_match(/not valid JSON/, response.parsed_body['error'])

      validate make_endpoint(:es, 'http://es.example.com:9200/_search', name: 'Bare'), index_name: 'movies', definition: '{}'

      assert_equal DatasetIndex::Review::NO_INDEX_NAME, response.parsed_body['error']
      assert_not_requested :any, /.*/
    end

    test 'needs a search endpoint the user can use' do
      validate make_endpoint(:es, 'http://es.example.com:9200/movies/_search').tap { |endpoint| endpoint.update!(owner: users(:doug)) },
               index_name: 'movies', definition: '{}'

      assert_redirected_to dataset_cases_url
    end
  end
end
