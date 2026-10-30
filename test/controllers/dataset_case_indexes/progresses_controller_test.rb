# frozen_string_literal: true

require 'test_helper'

module DatasetCaseIndexes
  class ProgressesControllerTest < ActionDispatch::IntegrationTest
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

    test 'progress records how far the browser has got, and why it stopped' do
      es = make_endpoint(:es, 'http://localhost:9200/movies/_search')
      patch dataset_case_index_progress_url(@link), params: { search_endpoint_id: es.id, status: 'indexing', documents_indexed: 500 }

      assert_response :no_content
      @link.reload

      assert_equal [ 'indexing', 500, nil ], [ @link.indexing_status, @link.documents_indexed, @link.indexing_error ]

      patch dataset_case_index_progress_url(@link), params: { search_endpoint_id: es.id, status: 'failed', documents_indexed: 500, error: 'it broke' }

      assert_equal [ 'failed', 'it broke' ], [ @link.reload.indexing_status, @link.indexing_error ]
    end
  end
end
