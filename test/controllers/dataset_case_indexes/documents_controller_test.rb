# frozen_string_literal: true

require 'test_helper'

module DatasetCaseIndexes
  class DocumentsControllerTest < ActionDispatch::IntegrationTest
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

    test 'stream gives the documents one a line, and only to whoever may load them' do
      give_documents
      es = make_endpoint(:es, 'http://localhost:9200/movies/_search')
      get dataset_case_index_documents_url(@link, search_endpoint_id: es.id)

      assert_response :success
      docs = response.body.lines.map { |line| JSON.parse(line) }

      assert_equal @documents, docs.size
      assert(docs.all? { |doc| doc['id'].present? })

      @case.update!(book: nil)
      get dataset_case_index_documents_url(@link, search_endpoint_id: es.id)

      assert_response :unprocessable_content
    end

    test 'documents starts loading into the schema the user deployed, creating nothing, and points the case at the endpoint' do
      give_documents
      vespa = make_endpoint(:searchapi, 'https://a.vespa.cloud/search/', mapper: 'vespa')

      assert_enqueued_with(job: IndexDatasetDocumentsJob) do
        post dataset_case_index_documents_url(@link), params: { search_endpoint_id: vespa.id, index_name: 'my_schema' }
      end

      assert_redirected_to dataset_cases_url
      assert_match(/Its #{@documents} documents are being indexed in the background/, flash[:notice])
      assert_equal %w[my_schema pending], [ @link.reload.index_name, @link.indexing_status ]
      assert_equal vespa, @case.tries.first.reload.search_endpoint
      assert_not_requested :any, /.*/
    end

    test 'documents refuses what it cannot load: a bad name, an engine Quepid creates itself, an engine with no loader, no documents' do
      give_documents
      vespa = make_endpoint(:searchapi, 'https://a.vespa.cloud/search/', mapper: 'vespa')
      es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
      algolia = make_endpoint(:algolia, 'https://APP-dsn.algolia.net/1/indexes/shop/query')

      [ [ vespa, 'Not Valid!', /is not a name Vespa accepts/ ], [ vespa, '../x', /is not a name/ ], [ es, 'movies', /creates this index itself/ ],
        [ algolia, 'shop', /cannot load documents into Algolia/ ] ].each do |endpoint, name, message|
        assert_no_enqueued_jobs only: IndexDatasetDocumentsJob do
          post dataset_case_index_documents_url(@link), params: { search_endpoint_id: endpoint.id, index_name: name }
        end

        assert_redirected_to dataset_case_index_url(@link, search_endpoint_id: endpoint.id)
        assert_match message, flash[:alert]
      end

      @case.update!(book: nil)
      post dataset_case_index_documents_url(@link), params: { search_endpoint_id: vespa.id, index_name: 'quepid_haystack' }

      assert_redirected_to dataset_case_index_url(@link, search_endpoint_id: vespa.id)
      assert_match(/Quepid has no documents for Haystack Rating Party, so there is nothing to load/, flash[:alert])
      assert_nil @case.tries.first.reload.search_endpoint
      assert_not_requested :any, /.*/
    end
  end
end
