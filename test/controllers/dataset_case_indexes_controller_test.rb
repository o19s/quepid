# frozen_string_literal: true

require 'test_helper'

class DatasetCaseIndexesControllerTest < ActionDispatch::IntegrationTest
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

  test 'show lays out the Elasticsearch index definition for the endpoint in a box to edit, and sends nothing' do
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    get dataset_case_index_url(@link, search_endpoint_id: es.id)

    assert_response :success
    assert_select 'table td a[href=?]', search_endpoint_path(es), text: 'My es'
    assert_select 'table td code', text: 'movies'
    assert_select '.card-header', text: /The index definition for Elasticsearch: edit it/
    assert_select 'form[data-controller~=json-editor][action=?]', dataset_case_index_path(@link) do
      assert_select 'input[name=index_name][value=movies]'
      assert_select 'textarea[name=definition]', text: /"dynamic": "strict"/
      assert_select 'textarea[name=definition]', text: /"number_of_shards": 1/
      assert_select 'input[name=search_endpoint_id][value=?]', es.id.to_s
    end
    assert_not_requested :any, /.*/
  end

  test 'show asks before creating, and says what will happen' do
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    get dataset_case_index_url(@link, search_endpoint_id: es.id)

    assert_select 'form[action=?] button[type=submit]', dataset_case_index_path(@link), text: 'Create the index'
    assert_select 'form[data-turbo-confirm=?]', 'Create the Elasticsearch index on My es with this definition?'
    assert_select 'p', text: /No documents will be indexed: Quepid has no documents for Haystack Rating Party, so only the index is created/
    assert_select 'button[data-action="json-editor#format"]', text: 'Format'
    assert_select 'button[data-action="json-editor#reset"]', text: 'Back to the proposed definition'
  end

  test 'show says where the documents fields come from' do
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    get dataset_case_index_url(@link, search_endpoint_id: es.id)

    assert_select '.card-header', text: /Where the documents. fields come from/
    assert_select 'td code', text: 'title'
    assert_select 'td', text: /the first of title, name that has a value/
    assert_select 'td', text: /product_type/
    assert_select 'td', text: /not available in this dataset/, minimum: 2
  end

  test 'show works for IMDb too, whose documents are not in Quepid' do
    imdb_link = CaseToDataset.create!(dataset: Dataset.for(user, 'imdb'), case: Case.create!(case_name: 'Movies', owner: user), status: 'done')
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    get dataset_case_index_url(imdb_link, search_endpoint_id: es.id)

    assert_response :success
    assert_select 'table td code', text: 'movies'
    assert_select 'td', text: /split on/
  end

  test 'show asks for an index name when the endpoint names none, and offers only using the endpoint' do
    [ make_endpoint(:es, 'http://es.example.com:9200/_search'), make_endpoint(:solr, 'http://solr.example.com:8983/solr/select') ].each do |endpoint|
      get dataset_case_index_url(@link, search_endpoint_id: endpoint.id)

      assert_response :success
      assert_select '.alert-warning', text: /\AQuepid cannot find an index name in the selected endpoint\. Please specify the index name\.\z/
      assert_select 'form[action=?]', dataset_case_index_path(@link), count: 0
      assert_select 'form[action=?] button', dataset_case_search_endpoint_path(@link), text: 'Only use this endpoint'
    end
  end

  test 'create and documents refuse an endpoint that names no index, and send nothing' do
    es = make_endpoint(:es, 'http://es.example.com:9200/_search')

    assert_no_difference 'SearchEndpoint.count' do
      assert_no_enqueued_jobs only: IndexDatasetDocumentsJob do
        post dataset_case_index_url(@link), params: { search_endpoint_id: es.id, index_name: 'wands', definition: '{"settings":{}}' }

        assert_response :unprocessable_content
        assert_equal DatasetIndex::Review::NO_INDEX_NAME, flash[:alert]

        post dataset_case_index_documents_url(@link), params: { search_endpoint_id: es.id }
      end
    end

    assert_not_requested :any, /.*/
    assert_nil @case.tries.first.reload.search_endpoint
  end

  test 'show says an endpoint of an engine without an index definition has none, and offers just using it' do
    static = make_endpoint(:static, 'http://localhost/search', name: 'A file')
    get dataset_case_index_url(@link, search_endpoint_id: static.id)

    assert_response :success
    assert_select '.alert-warning', text: /no index definition for Static File endpoints/
    assert_select '.alert-warning', text: /Elasticsearch, OpenSearch, Solr, Qdrant, Vespa, Algolia, and Vectara/
    assert_select 'pre', count: 0
    assert_select 'form[action=?] button', dataset_case_search_endpoint_path(@link), text: 'Only use this endpoint'
    assert_select 'form[action=?]', dataset_case_index_path(@link), count: 0
  end

  test 'show displays a definition Quepid cannot create read-only, with nothing to apply' do
    vespa = make_endpoint(:searchapi, 'https://a.vespa.cloud/search/', mapper: 'vespa')
    get dataset_case_index_url(@link, search_endpoint_id: vespa.id)

    assert_select '.card-header', text: /\AThe index definition for Vespa\z/
    assert_select 'pre code', text: /schema quepid_haystack/
    assert_select 'textarea', count: 0
    assert_select '.alert-secondary', text: /Quepid does not create indexes in Vespa\. Deploy this definition yourself/
    assert_select 'form[action=?]', dataset_case_index_path(@link), count: 0
  end

  test 'show explains that Qdrant needs the vector size, and uses the one the cases embedder has' do
    qdrant = make_endpoint(:searchapi, 'http://q.example.com:6333/collections/shop/points/query', mapper: 'qdrant')
    get dataset_case_index_url(@link, search_endpoint_id: qdrant.id)

    assert_select '.text-muted', text: /how long the vectors are/
    assert_select 'form[action=?]', dataset_case_index_path(@link), count: 0

    embedder = embedders(:openai_small)
    embedder.update_columns(dimensions: 384)
    @case.update!(embedder: embedder)
    get dataset_case_index_url(@link, search_endpoint_id: qdrant.id)

    assert_select 'textarea[name=definition]', text: /"size": 384/
    assert_select 'form[action=?] button[type=submit]', dataset_case_index_path(@link), text: 'Create the index'
  end

  test 'create makes the index, points the case at the endpoint, and indexes no documents' do
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    stub = stub_request(:put, 'http://es.example.com:9200/movies').to_return(status: 200, body: '{"acknowledged":true}')

    assert_no_difference [ 'Case.count', 'Query.count', 'Scorer.count' ] do
      post dataset_case_index_url(@link), params: { search_endpoint_id: es.id }
    end

    assert_requested stub, times: 1
    assert_requested :put, 'http://es.example.com:9200/movies', body: ->(body) { 'strict' == JSON.parse(body).dig('mappings', 'dynamic') }
    assert_redirected_to dataset_cases_url
    assert_match(/Created Elasticsearch index movies on My es\. Haystack case now searches it, with a starter query as Try 2/, flash[:notice])
    assert_equal es, @case.tries.first.reload.search_endpoint
  end

  test 'show asks which index first, the endpoints own or a new one, before the definition' do
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    get dataset_case_index_url(@link, search_endpoint_id: es.id)

    assert_select 'input[type=radio][name=new_endpoint][value="false"][checked]'
    assert_select 'input[type=radio][name=new_endpoint][value="true"]:not([checked])'
    assert_select 'input[name=index_name][readonly][value=movies]'
    assert_select 'form[data-json-editor-new-name-value=?]', 'haystack', message: 'a new index is named after the dataset, unless it is the current one'
    body = response.body

    assert_operator body.index('Which index?'), :<, body.index('The index definition for')
  end

  test 'show has a check availability button for the new index choice' do
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    get dataset_case_index_url(@link, search_endpoint_id: es.id)

    assert_select 'button[data-json-editor-target=availabilityButton][hidden]', text: 'Check availability'
    assert_select 'form[data-json-editor-availability-url-value=?]', dataset_case_index_availability_path(@link, search_endpoint_id: es.id)
  end

  test 'show gives the browser what it needs to check a name itself, unless the endpoint is proxied' do
    es = make_endpoint(:es, 'http://localhost:9200/movies/_search')
    es.update!(basic_auth_credential: 'user:secret')
    get dataset_case_index_url(@link, search_endpoint_id: es.id)

    probe = JSON.parse(css_select('form[data-json-editor-probe-value]').first['data-json-editor-probe-value'])

    assert_equal 'http://localhost:9200', probe['origin']
    assert_equal 'es', probe['engine']
    assert_equal "Basic #{Base64.strict_encode64('user:secret')}", probe['headers']['Authorization']

    es.update!(proxy_requests: true)
    get dataset_case_index_url(@link, search_endpoint_id: es.id)

    assert_select 'form[data-json-editor-probe-value]', count: 0
  end

  test 'create can make a new search endpoint for the new index, copying the chosen endpoint' do
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    es.update!(basic_auth_credential: 'user:secret', custom_headers: '{"X-Key":"1"}')
    stub_request(:put, 'http://es.example.com:9200/wands').to_return(status: 200, body: '{"acknowledged":true}')

    assert_difference 'SearchEndpoint.count', 1 do
      post dataset_case_index_url(@link), params: { search_endpoint_id: es.id, index_name: 'wands', definition: '{"settings":{}}', new_endpoint: 'true' }
    end

    copy = SearchEndpoint.order(:id).last

    assert_equal 'http://es.example.com:9200/wands/_search', copy.endpoint_url
    assert_equal [ 'user:secret', { 'X-Key' => '1' }, user ], [ copy.basic_auth_credential, copy.custom_headers, copy.owner ]
    assert_equal copy, @case.tries.reload.first.search_endpoint
    assert_equal 'http://es.example.com:9200/movies/_search', es.reload.endpoint_url
  end

  test 'create sends the definition as the user edited it, under the name they gave it' do
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    stub = stub_request(:put, 'http://es.example.com:9200/my-movies').to_return(status: 200, body: '{"acknowledged":true}')
    edited = { 'settings' => { 'number_of_shards' => 3 }, 'mappings' => { 'properties' => { 'title' => { 'type' => 'text' } } } }

    post dataset_case_index_url(@link), params: { search_endpoint_id: es.id, index_name: ' my-movies ', definition: JSON.pretty_generate(edited) }

    assert_requested stub, times: 1
    assert_requested :put, 'http://es.example.com:9200/my-movies', body: edited.to_json
    assert_not_requested :put, 'http://es.example.com:9200/movies'
    assert_match(/Created Elasticsearch index my-movies/, flash[:notice])
  end

  test 'create keeps the edit and shows the reason when the definition is not valid JSON' do
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')

    post dataset_case_index_url(@link), params: { search_endpoint_id: es.id, index_name: 'mine', definition: '{ "settings": oops' }

    assert_response :unprocessable_content
    assert_select '.alert', text: /The definition is not valid JSON/
    assert_select 'textarea[name=definition]', text: /"settings": oops/
    assert_select 'input[name=index_name][value=mine]'
    assert_not_requested :any, /.*/
    assert_nil @case.tries.first.reload.search_endpoint
  end

  test 'create refuses a definition that is not an object, and a name that is not safe for an address' do
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')

    post dataset_case_index_url(@link), params: { search_endpoint_id: es.id, index_name: 'movies', definition: '[1, 2]' }

    assert_response :unprocessable_content
    assert_select '.alert', text: /must be a JSON object/

    [ '../_all', 'a/b', 'UPPER', '', 'has space', '_hidden' ].each do |name|
      post dataset_case_index_url(@link), params: { search_endpoint_id: es.id, index_name: name, definition: '{}' }

      assert_response :unprocessable_content, name.inspect
      assert_select '.alert', text: /Give the index a name|is not a name Elasticsearch accepts/, count: 1
    end
    assert_not_requested :any, /.*/
  end

  test 'create takes only add commands for Solr, and a collection and payload indexes for Qdrant' do
    solr = make_endpoint(:solr, 'http://solr.example.com:8983/solr/shop/select')

    post dataset_case_index_url(@link), params: { search_endpoint_id: solr.id, index_name: 'shop', definition: '{"delete-field": {"name": "title"}}' }

    assert_response :unprocessable_content
    assert_select '.alert', text: /only sends add commands to Solr.*not delete-field/

    qdrant = make_endpoint(:searchapi, 'http://q.example.com:6333/collections/shop/points/query', mapper: 'qdrant')
    embedder = embedders(:openai_small)
    embedder.update_columns(dimensions: 8)
    @case.update!(embedder: embedder)
    [ '{}', '{"collection": {"vectors": {"dense": {"size": 8}}}, "payload_indexes": "all"}',
      '{"collection": {"vectors": {"dense": {"size": 8}}}, "payload_indexes": [{"field_name": "x"}]}' ].each do |definition|
      post dataset_case_index_url(@link), params: { search_endpoint_id: qdrant.id, index_name: 'shop', definition: definition }

      assert_response :unprocessable_content, definition
    end
    assert_not_requested :any, /.*/
  end

  test 'create without an edited definition sends the proposed one' do
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    stub_request(:put, 'http://es.example.com:9200/movies').to_return(status: 200, body: '{"acknowledged":true}')

    post dataset_case_index_url(@link), params: { search_endpoint_id: es.id }

    assert_requested :put, 'http://es.example.com:9200/movies', body: DatasetIndex.build(endpoint: es, dataset: DatasetCatalog.find('haystack')).body.to_json
  end

  test 'create shows the review again, with the reason and the edit, when the index is already there' do
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    stub_request(:put, 'http://es.example.com:9200/movies').to_return(status: 400, body: '{"error":{"type":"resource_already_exists_exception"}}')

    post dataset_case_index_url(@link), params: { search_endpoint_id: es.id, index_name: 'movies', definition: '{"settings": {"number_of_shards": 2}}' }

    assert_response :unprocessable_content
    assert_select '.alert', text: /The index movies already exists on My es/
    assert_select 'textarea[name=definition]', text: /"number_of_shards": 2/
    assert_nil @case.tries.first.reload.search_endpoint
  end

  test 'create shows the review again when the endpoint refuses or cannot be reached' do
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    stub_request(:put, 'http://es.example.com:9200/movies').to_return(status: 401, body: 'unauthorized')

    post dataset_case_index_url(@link), params: { search_endpoint_id: es.id }

    assert_response :unprocessable_content
    assert_select '.alert', text: /answered 401/

    stub_request(:put, 'http://es.example.com:9200/movies').to_timeout
    post dataset_case_index_url(@link), params: { search_endpoint_id: es.id }

    assert_select '.alert', text: /Could not reach/
    assert_nil @case.tries.first.reload.search_endpoint
  end

  test 'create refuses a definition Quepid cannot apply, and sends nothing' do
    vespa = make_endpoint(:searchapi, 'https://a.vespa.cloud/search/', mapper: 'vespa')
    static = make_endpoint(:static, 'http://localhost/search', name: 'A file')

    [ vespa, static ].each do |endpoint|
      post dataset_case_index_url(@link), params: { search_endpoint_id: endpoint.id }

      assert_response :unprocessable_content
      assert_select '.alert', minimum: 1
    end

    assert_not_requested :any, /.*/
    assert_nil @case.tries.first.reload.search_endpoint
  end

  test 'create applies a Solr definition to the collection the address names' do
    solr = make_endpoint(:solr, 'http://solr.example.com:8983/solr/shop/select')
    stub = stub_request(:post, 'http://solr.example.com:8983/solr/shop/schema').to_return(status: 200, body: '{"responseHeader":{"status":0}}')

    post dataset_case_index_url(@link), params: { search_endpoint_id: solr.id }

    assert_requested stub
    assert_equal solr, @case.tries.first.reload.search_endpoint
  end

  test 'create adds the Solr fields to the new collection, and loads the documents there, not into the chosen one' do
    wands_case = Case.create!(case_name: 'WANDS', owner: user)
    wands = CaseToDataset.create!(dataset: Dataset.for(user, 'wands'), case: wands_case, status: 'done')
    solr = make_endpoint(:solr, 'http://solr.example.com:8983/solr/shop/select')
    schema = stub_request(:post, 'http://solr.example.com:8983/solr/wands/schema').to_return(status: 200, body: '{"responseHeader":{"status":0}}')

    assert_enqueued_with(job: IndexDatasetDocumentsJob, args: ->(args) { 'http://solr.example.com:8983/solr/wands/select' == args[1].endpoint_url }) do
      post dataset_case_index_url(wands), params: { search_endpoint_id: solr.id, index_name: 'wands', definition: DatasetIndex::Solr.commands.to_json, new_endpoint: 'true' }
    end

    assert_requested schema
    assert_not_requested :post, %r{/solr/shop/}
    assert_equal 'http://solr.example.com:8983/solr/wands/select', wands_case.tries.first.reload.search_endpoint.endpoint_url
  end

  test 'create keeps no endpoint for a new Solr collection that is not there, and loads nothing' do
    wands_case = Case.create!(case_name: 'WANDS', owner: user)
    wands = CaseToDataset.create!(dataset: Dataset.for(user, 'wands'), case: wands_case, status: 'done')
    solr = make_endpoint(:solr, 'http://solr.example.com:8983/solr/shop/select')
    stub_request(:post, 'http://solr.example.com:8983/solr/wands/schema').to_return(status: 404, body: 'Not Found')

    assert_no_difference 'SearchEndpoint.count' do
      assert_no_enqueued_jobs only: IndexDatasetDocumentsJob do
        post dataset_case_index_url(wands), params: { search_endpoint_id: solr.id, index_name: 'wands', definition: DatasetIndex::Solr.commands.to_json, new_endpoint: 'true' }
      end
    end

    assert_response :unprocessable_content
    assert_match(/There is no collection wands on My solr \(wands\): Solr cannot make one from Quepid, so create it first/, flash[:alert])
    assert_not_requested :post, %r{/solr/shop/}
    assert_nil wands.reload.index_name
  end

  test 'it needs a search endpoint the user can use' do
    theirs = make_endpoint(:es, 'http://es.example.com:9200/movies/_search', owner: users(:doug))
    archived = make_endpoint(:es, 'http://es.example.com:9200/old/_search')
    archived.update!(archived: true)

    [ nil, 0, theirs.id, archived.id ].each do |id|
      get dataset_case_index_url(@link, search_endpoint_id: id)

      assert_redirected_to dataset_cases_url
      assert_match(/Pick a search endpoint/, flash[:alert])
      post dataset_case_index_url(@link), params: { search_endpoint_id: id }

      assert_redirected_to dataset_cases_url
    end
    assert_not_requested :any, /.*/
  end

  test 'it is only for the users own cases that have finished loading' do
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    other = CaseToDataset.create!(dataset: Dataset.for(users(:doug), 'imdb'), case: Case.create!(case_name: 'Theirs', owner: users(:doug)), status: 'done')

    get dataset_case_index_url(other, search_endpoint_id: es.id)

    assert_response :not_found

    @link.update!(status: 'loading')
    get dataset_case_index_url(@link, search_endpoint_id: es.id)

    assert_redirected_to dataset_cases_url
    assert_match(/still loading/, flash[:alert])

    @link.update!(status: 'done')
    @case.update!(owner: users(:doug))
    post dataset_case_index_url(@link), params: { search_endpoint_id: es.id }

    assert_match(/belongs to someone else/, flash[:alert])
    assert_not_requested :any, /.*/
  end

  test 'show offers to create the index and start indexing the data when Quepid has the documents and can load them' do
    give_documents
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    get dataset_case_index_url(@link, search_endpoint_id: es.id)

    assert_operator @documents, :>, 0
    assert_select 'form[action=?] button[type=submit]', dataset_case_index_path(@link), text: 'Create index and start indexing the data'
    assert_select 'form[data-turbo-confirm*=?]', 'and start indexing the documents'
    assert_select 'strong', text: "#{@documents} documents"
    assert_select 'p', text: /No documents will be indexed/, count: 0
  end

  test 'show only offers to create the index when the dataset has no documents in Quepid, or the engine cannot be loaded' do
    imdb = CaseToDataset.create!(dataset: Dataset.for(user, 'imdb'), case: Case.create!(case_name: 'Movies', owner: user), status: 'done')
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    get dataset_case_index_url(imdb, search_endpoint_id: es.id)

    assert_select 'p', text: /No documents will be indexed: Quepid has no documents for IMDb/
    assert_select 'button[type=submit]', text: 'Create the index'

    give_documents
    qdrant = make_endpoint(:searchapi, 'http://q.example.com:6333/collections/shop/points/query', mapper: 'qdrant')
    embedder = embedders(:openai_small)
    embedder.update_columns(dimensions: 8)
    @case.update!(embedder: embedder)
    get dataset_case_index_url(@link, search_endpoint_id: qdrant.id)

    assert_select 'p', text: /No documents will be indexed: Quepid cannot load documents into Qdrant yet/
    assert_select 'button[type=submit]', text: 'Create the index'
  end

  test 'create makes the index and queues the documents to be indexed, then shows the progress on the link' do
    give_documents
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    stub_request(:put, 'http://es.example.com:9200/my-movies').to_return(status: 200, body: '{"acknowledged":true}')

    assert_enqueued_with(job: IndexDatasetDocumentsJob) do
      post dataset_case_index_url(@link), params: { search_endpoint_id: es.id, index_name: 'my-movies', definition: '{}' }
    end

    @link.reload

    assert_equal [ 'my-movies', 'pending', 0 ], [ @link.index_name, @link.indexing_status, @link.documents_indexed ]
    assert_match(/Its #{@documents} documents are being indexed in the background/, flash[:notice])
    assert_equal es, @case.tries.first.reload.search_endpoint
  end

  test 'create with applied set leaves creating the index to the browser, and the loading too' do
    give_documents
    es = make_endpoint(:es, 'http://localhost:9200/movies/_search')

    assert_no_enqueued_jobs only: IndexDatasetDocumentsJob do
      post dataset_case_index_url(@link), params: { search_endpoint_id: es.id, index_name: 'my-movies', definition: '{}', applied: 'true' }, as: :html,
                                          headers: { 'Accept' => 'application/json' }
    end

    assert_not_requested :any, /localhost/
    assert_equal({ 'redirect' => dataset_cases_path, 'load' => true, 'total' => @documents }, response.parsed_body)
    @link.reload

    assert_equal [ 'my-movies', 'indexing', 0 ], [ @link.index_name, @link.indexing_status, @link.documents_indexed ]
    assert_equal es, @case.tries.first.reload.search_endpoint
  end

  test 'create with applied set answers JSON, also when the browser sent a definition that is not valid' do
    es = make_endpoint(:es, 'http://localhost:9200/movies/_search')
    post dataset_case_index_url(@link), params: { search_endpoint_id: es.id, index_name: 'movies', definition: '[1, 2]', applied: true }, as: :json

    assert_response :unprocessable_content
    assert_match(/must be a JSON object/, response.parsed_body['error'])
  end

  test 'create without documents queues nothing, and says so' do
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    stub_request(:put, 'http://es.example.com:9200/movies').to_return(status: 200, body: '{"acknowledged":true}')

    assert_no_enqueued_jobs only: IndexDatasetDocumentsJob do
      post dataset_case_index_url(@link), params: { search_endpoint_id: es.id }
    end

    assert_match(/No documents were indexed: Quepid has no documents for Haystack Rating Party/, flash[:notice])
    assert_nil @link.reload.indexing_status
  end

  test 'for an engine Quepid cannot create, show says it stops, and offers loading once the user has deployed it' do
    give_documents
    vespa = make_endpoint(:searchapi, 'https://a.vespa.cloud/search/', mapper: 'vespa')
    get dataset_case_index_url(@link, search_endpoint_id: vespa.id)

    assert_select '.alert-secondary', text: /Quepid does not create indexes in Vespa.*sends nothing until you say you have deployed it/m
    assert_select 'form[action=?]', dataset_case_index_path(@link), count: 0
    assert_select 'form[action=?]', dataset_case_index_documents_path(@link) do
      assert_select 'input[name=index_name][value=quepid_haystack]'
      assert_select 'button[type=submit]', text: 'I have deployed this. Start loading'
      assert_select 'input[name=search_endpoint_id][value=?]', vespa.id.to_s
    end
    assert_select 'strong', text: "#{@documents} documents"
    assert_select 'p', text: /one at a time through Vespa.s Document API/
    assert_not_requested :any, /.*/
  end

  test 'for an engine Quepid cannot create or load, show offers nothing to load, and says why' do
    give_documents
    algolia = make_endpoint(:algolia, 'https://APP-dsn.algolia.net/1/indexes/shop/query')
    get dataset_case_index_url(@link, search_endpoint_id: algolia.id)

    assert_select 'form[action=?]', dataset_case_index_documents_path(@link), count: 0
    assert_select 'p', text: /Quepid does not load documents here: Quepid cannot load documents into Algolia yet/

    @case.update!(book: nil)
    vespa = make_endpoint(:searchapi, 'https://a.vespa.cloud/search/', mapper: 'vespa')
    get dataset_case_index_url(@link, search_endpoint_id: vespa.id)

    assert_select 'form[action=?]', dataset_case_index_documents_path(@link), count: 0
    assert_select 'p', text: /Quepid does not load documents here: Quepid has no documents for Haystack Rating Party/
  end

  CHORUS = 'http://chorus.dev.o19s.com:8983/solr/ecommerce/select'

  test 'show proposes no schema for an endpoint where the dataset is already indexed, only using it' do
    give_documents
    chorus = make_endpoint(:solr, CHORUS, name: 'Chorus')
    get dataset_case_index_url(@link, search_endpoint_id: chorus.id)

    assert_response :success
    assert_select '.alert-success', text: /Haystack Rating Party is already indexed in Chorus.*no index to propose, create or load/m
    assert_select 'pre', count: 0
    assert_select 'textarea', count: 0
    assert_select 'form[action=?]', dataset_case_index_path(@link), count: 0
    assert_select 'form[action=?]', dataset_case_index_documents_path(@link), count: 0
    assert_select 'form[action=?] button', dataset_case_search_endpoint_path(@link), text: 'Only use this endpoint'
    assert_not_requested :any, /.*/
  end

  test 'show still proposes a schema for another Solr, for another dataset, and for another backend of the same dataset' do
    other_solr = make_endpoint(:solr, 'http://solr.example.com:8983/solr/shop/select')
    get dataset_case_index_url(@link, search_endpoint_id: other_solr.id)

    assert_select '.alert-success', count: 0
    assert_select 'textarea[name=definition]', text: /add-field/

    imdb = CaseToDataset.create!(dataset: Dataset.for(user, 'imdb'), case: Case.create!(case_name: 'Movies', owner: user), status: 'done')
    chorus = make_endpoint(:solr, CHORUS, name: 'Chorus')
    get dataset_case_index_url(imdb, search_endpoint_id: chorus.id)

    assert_select '.alert-success', count: 0
    assert_select 'textarea[name=definition]'
  end

  test 'create and documents refuse an endpoint where the dataset is already indexed, and send nothing' do
    give_documents
    chorus = make_endpoint(:solr, CHORUS, name: 'Chorus')

    assert_no_enqueued_jobs only: IndexDatasetDocumentsJob do
      post dataset_case_index_url(@link), params: { search_endpoint_id: chorus.id }

      assert_response :unprocessable_content
      assert_select '.alert', text: /already indexed in Chorus, so there is nothing to create or load there/

      post dataset_case_index_documents_url(@link), params: { search_endpoint_id: chorus.id, index_name: 'ecommerce' }

      assert_redirected_to dataset_case_index_url(@link, search_endpoint_id: chorus.id)
      assert_match(/already indexed in Chorus/, flash[:alert])
    end
    assert_not_requested :any, /.*/
    assert_nil @case.tries.first.reload.search_endpoint
  end

  test 'create gives the case a new try with a starter query for Elasticsearch, and keeps its old try' do
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    stub_request(:put, 'http://es.example.com:9200/movies').to_return(status: 200, body: '{"acknowledged":true}')
    old = @case.tries.first
    old.update!(query_params: 'q=#$query##&useParams=old')

    post dataset_case_index_url(@link), params: { search_endpoint_id: es.id }

    newest = @case.reload.tries.first

    assert_not_equal old, newest
    assert_equal es, newest.search_endpoint
    assert_equal DatasetIndex::SearchSetup::STARTERS.fetch('es')[:query_params], newest.query_params
    assert_equal 'id:_id, title:title, thumb:thumb, brand, category', newest.field_spec
    assert_equal 'q=#$query##&useParams=old', old.reload.query_params
    assert_match(/with a starter query as Try 2 \(its earlier settings are still in its history\)/, flash[:notice])
  end

  test 'create for an engine with no starter query only gives the latest try the endpoint' do
    qdrant = make_endpoint(:searchapi, 'http://q.example.com:6333/collections/shop/points/query', mapper: 'qdrant')
    embedder = embedders(:openai_small)
    embedder.update_columns(dimensions: 8)
    @case.update!(embedder: embedder)
    stub_request(:put, 'http://q.example.com:6333/collections/shop').to_return(status: 200, body: '{"result":true}')
    stub_request(:put, 'http://q.example.com:6333/collections/shop/index').to_return(status: 200, body: '{"result":true}')

    assert_no_difference 'Try.count' do
      post dataset_case_index_url(@link), params: { search_endpoint_id: qdrant.id }
    end

    assert_equal qdrant, @case.tries.first.reload.search_endpoint
    assert_match(/now searches it\./, flash[:notice])
  end

  test 'create makes a new Qdrant collection, and points the case at a copy of the endpoint that queries it' do
    qdrant = make_endpoint(:searchapi, 'http://q.example.com:6333/collections/shop/points/query', mapper: 'qdrant')
    embedder = embedders(:openai_small)
    embedder.update_columns(dimensions: 8)
    @case.update!(embedder: embedder)
    definition = DatasetIndex.build(endpoint: qdrant, dataset: DatasetCatalog.find('haystack'), vector_size: 8).text
    create = stub_request(:put, 'http://q.example.com:6333/collections/wands').to_return(status: 200, body: '{"result":true}')
    stub_request(:put, 'http://q.example.com:6333/collections/wands/index').to_return(status: 200, body: '{"result":true}')

    assert_difference 'SearchEndpoint.count', 1 do
      post dataset_case_index_url(@link), params: { search_endpoint_id: qdrant.id, index_name: 'wands', definition: definition, new_endpoint: 'true' }
    end

    assert_requested create
    copy = @case.tries.first.reload.search_endpoint

    assert_equal [ 'http://q.example.com:6333/collections/wands/points/query', 'qdrant' ], [ copy.endpoint_url, copy.mapper_based_search_engine_id ]
    assert_equal 'http://q.example.com:6333/collections/shop/points/query', qdrant.reload.endpoint_url
  end

  test 'show offers a new Qdrant collection next to the endpoint\'s own' do
    qdrant = make_endpoint(:searchapi, 'http://q.example.com:6333/collections/shop/points/query', mapper: 'qdrant')
    embedder = embedders(:openai_small)
    embedder.update_columns(dimensions: 8)
    @case.update!(embedder: embedder)
    get dataset_case_index_url(@link, search_endpoint_id: qdrant.id)

    assert_select 'input[type=radio][name=new_endpoint][value="false"][checked]'
    assert_select 'input[type=radio][name=new_endpoint][value="true"]'
  end

  test 'a form that asks before it does something is handled by Turbo, which is what asks: Turbo is not turned off on it' do
    give_documents
    es = make_endpoint(:es, 'http://es.example.com:9200/movies/_search')
    vespa = make_endpoint(:searchapi, 'https://a.vespa.cloud/search/', mapper: 'vespa')

    [ es, vespa ].each do |endpoint|
      get dataset_case_index_url(@link, search_endpoint_id: endpoint.id)

      confirming = css_select('form[data-turbo-confirm]')

      assert_equal 1, confirming.size, endpoint.search_engine
      assert_nil confirming.first['data-turbo'], 'data-turbo="false" would skip the confirmation'
      assert_empty css_select('button[data-turbo-confirm]'), 'a confirmation on a button is not asked for either'
    end
  end

  test 'the confirmation says what is about to happen for each kind of engine' do
    give_documents
    get dataset_case_index_url(@link, search_endpoint_id: make_endpoint(:es, 'http://es.example.com:9200/movies/_search').id)

    assert_select 'form[data-turbo-confirm*=?]', 'with this definition and start indexing the documents?'

    get dataset_case_index_url(@link, search_endpoint_id: make_endpoint(:searchapi, 'https://a.vespa.cloud/search/', mapper: 'vespa').id)

    assert_select 'form[data-turbo-confirm*=?]', "Load #{@documents} documents into"
    assert_select 'form[data-turbo-confirm*=?]', 'Is the definition deployed there?'
  end

  test 'show offers to index the 42,994 WANDS products, from a case that holds none of them' do
    wands = CaseToDataset.create!(dataset: Dataset.for(user, 'wands'), case: Case.create!(case_name: 'WANDS', owner: user), status: 'done')
    es = make_endpoint(:es, 'http://es.example.com:9200/wands/_search')
    get dataset_case_index_url(wands, search_endpoint_id: es.id)

    assert_response :success
    assert_select 'strong', text: '42,994 documents'
    assert_select 'button[type=submit]', text: 'Create index and start indexing the data'
    assert_select 'table td code', text: 'wands'
    assert_select 'td', text: /`?category hierarchy`?.*product_class|category hierarchy/
    assert_select 'td', text: /product_name/
    assert_select 'td', text: /average_rating.*as a number/
    assert_not_requested :any, /.*/
  end

  test 'create makes the index for WANDS and queues indexing its products, with a starter query for the case' do
    wands_case = Case.create!(case_name: 'WANDS', owner: user)
    wands = CaseToDataset.create!(dataset: Dataset.for(user, 'wands'), case: wands_case, status: 'done')
    es = make_endpoint(:es, 'http://es.example.com:9200/wands/_search')
    stub_request(:put, 'http://es.example.com:9200/wands').to_return(status: 200, body: '{"acknowledged":true}')

    assert_enqueued_with(job: IndexDatasetDocumentsJob) do
      post dataset_case_index_url(wands), params: { search_endpoint_id: es.id }
    end

    assert_match(/Its 42,994 documents are being indexed in the background/, flash[:notice])
    assert_equal %w[wands pending], [ wands.reload.index_name, wands.indexing_status ]
    assert_equal es, wands_case.tries.first.reload.search_endpoint
    assert_equal 'Elasticsearch starter query', wands_case.tries.first.name
  end
end
