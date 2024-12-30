# frozen_string_literal: true

require 'test_helper'

class FetchServiceTest < ActiveSupport::TestCase
  # Need to make the url.
  # Need to understand the hTTP verb, GET, POST, JSONP
  # Need to send the url with each query, swapping in the template.
  # Need to also send the body with the qOptions as appropirate.
  # Need to understand if it worked or not.
  # Need to store the results as a snapshot.
  #  - Need ot use the snapshot structure to manage the lifecycle of the runs.
  #

  let(:try_with_headers)      { tries(:try_with_headers) }
  let(:case_with_ratings)     { cases(:random_case) }
  let(:search_endpoint)       { search_endpoints(:try_with_headers) }
  let(:options) do
    {
      debug_mode:     false,
      snapshot_limit: 3,
    }
  end

  describe 'Creating an appropriate search query from Quepid data' do
    let(:acase)         { cases(:queries_case) }
    let(:atry)          { tries(:for_case_queries_case) }
    let(:es_try_with_curator_vars) { tries(:es_try_with_curator_vars) }
    let(:try_with_headers) { tries(:try_with_headers) }
    let(:first_query) { queries(:first_query) }
    let(:blowup_query) { queries(:blowup_query) }

    it 'handles appending rows count defined by try' do
      fetch_service = FetchService.new options

      url = fetch_service.send(:create_url, atry.search_endpoint, atry)
      assert_includes url, 'rows=10'
    end

    it 'handles appending fl definition defined by try' do
      fetch_service = FetchService.new options

      url = fetch_service.send(:create_url, atry.search_endpoint, atry)
      assert_includes url, 'fl=id,title'
    end

    it 'handles appending fl definition defined by try 2' do
      fetch_service = FetchService.new options
      atry.field_spec = 'id:id, title:title, thumb:img_500x500, name, brand, product_type'

      url = fetch_service.send(:create_url, atry.search_endpoint, atry)
      assert_includes url, 'fl=id,title,img_500x500,name,brand,product_type'
    end

    it 'creates a GET request' do
      fetch_service = FetchService.new options
      response = fetch_service.make_request(atry, first_query)
      assert_not_nil response
      assert 200 == response.status
    end

    it 'works with custom headers and JSONP' do
      fetch_service = FetchService.new options
      response = fetch_service.make_request(try_with_headers, first_query)
      assert_not_nil response
      assert 200 == response.status
    end

    it 'creates a POST request' do
      fetch_service = FetchService.new options
      response = fetch_service.make_request(es_try_with_curator_vars, first_query)
      assert_not_nil response
      assert 200 == response.status
    end

    it 'handles a failed search request' do
      fetch_service = FetchService.new options
      response = fetch_service.make_request(atry, blowup_query)
      assert_not_nil response
      assert 404 == response.status
    end

    it 'handles a missing search_endpoint' do
      fetch_service = FetchService.new options
      atry.search_endpoint = nil
      response = fetch_service.make_request(atry, blowup_query)
      assert_not_nil response
      assert 400 == response.status
    end
  end

  describe 'Running a fetch cycle produces a snapshot' do
    let(:acase)         { cases(:queries_case) }
    let(:atry)          { tries(:for_case_queries_case) }
    let(:first_query)   { queries(:first_query) }
    let(:second_query)  { queries(:second_query) }

    it 'creates a snapshot when you begin' do
      fetch_service = FetchService.new options
      assert_difference 'acase.snapshots.count' do
        snapshot = fetch_service.begin(acase, atry)
        assert snapshot.name.starts_with?('Fetch [BEGUN]')
      end
    end

    it 'saves a snapshot query for each run' do
      fetch_service = FetchService.new options
      fetch_service.begin(acase, atry)

      docs = [
        { id: 'doc1', explain: '1' },
        { id: 'doc2', explain: '2' }
      ]

      response_status = 200
      response_body = ''

      assert_difference 'first_query.snapshot_queries.count' do
        snapshot_query = fetch_service.store_query_results first_query, docs, response_status, response_body
        snapshot_query.reload # reload in order to check the underlying data
        assert_equal docs.size, snapshot_query.snapshot_docs.size
        assert_equal response_status, snapshot_query.response_status
      end
    end

    it 'limits how many snapshots you can have when completed' do
      fetch_service = FetchService.new options
      assert_difference 'acase.snapshots.count', 6 do
        6.times do
          fetch_service.begin(acase, atry)
        end
      end

      assert acase.snapshots.count > options[:snapshot_limit]

      snapshot = fetch_service.begin(acase, atry)

      fetch_service.complete

      assert snapshot.name.starts_with?('Fetch [COMPLETED]')

      assert_equal options[:snapshot_limit], acase.snapshots.count
    end
  end

  describe 'parsing a response' do
    it 'lets you create a response' do
      response = Faraday::Response.new(status: 200)
      assert_equal 200, response.status
    end
  end

  describe 'Extracting snapshot_docs' do
    let(:asnapshot) { snapshots(:a_snapshot) }
    let(:snapshot_query) { snapshot_queries(:first_snapshot_query) }

    it 'lets you extract from raw solr dump' do
      mock_solr_response_body = <<~HEREDOC
        {
          "responseHeader":{
            "zkConnected":true,
            "status":0,
            "QTime":0,
            "params":{
              "q":"milk",
              "tie":"1.0",
              "pf":"title"}},
          "response":{"numFound":1,"start":0,"numFoundExact":true,"docs":[
              {
                "id":"10139",
                "title":["Milk"],#{'             '}
                "title_idioms":["Milk"],#{'              '}
                "text_all":["Milk",
                  "The true story of Harvey Milk, the first openly gay man ever elected to public office. In San Francisco in the late 1970s, Harvey Milk becomes an activist for gay rights and inspires others to join him in his fight for equal rights that should be available to all Americans.",
                  "Never blend in.",
                  "Gus Van Sant",
                  "Sean Penn",#{'                '}
                  "Drama"],
                "overview":["The true story of Harvey Milk, the first openly gay man ever elected to public office. In San Francisco in the late 1970s, Harvey Milk becomes an activist for gay rights and inspires others to join him in his fight for equal rights that should be available to all Americans."],
                "release_date":"2008-11-05T00:00:00Z",
                "vote_average":7.3,
                "vote_count":1345,
                "_version_":1798800449303740416}]
          },
          "debug":{
              "rawquerystring":"milk",
              "querystring":"milk",
              "parsedquery":"+DisjunctionMaxQuery((text_all:milk)~1.0) () FunctionQuery(float(vote_average))",
              "parsedquery_toString":"+(text_all:milk)~1.0 () float(vote_average)",
              "explain":{
                "10139":{
                  "match":true,
                  "value":13.647848
                }
              }
          }
        }
      HEREDOC

      response_body = mock_solr_response_body
      fetch_service = FetchService.new options
      docs = fetch_service.extract_docs_from_response_body_for_solr response_body
      assert_equal 1, docs.count

      doc = docs.first
      assert_equal '10139', doc[:id]
      assert_not_nil doc[:explain]
      assert_nothing_raised { JSON.parse(doc[:explain]) }

      expected_explain = { match: true, value: 13.647848 }

      assert_equal expected_explain, JSON.parse(doc[:explain], symbolize_names: true)

      assert_equal 8, doc[:fields].keys.count
      assert_equal 1345, doc[:fields]['vote_count']
      assert_equal 6, doc[:fields]['text_all'].count
    end

    it 'handles no debug section' do
      mock_solr_response_body = <<~HEREDOC
        {
          "responseHeader":{},
          "response":{"docs":[
              {
                "id":"10139",
                "title":["Milk"],#{'             '}
                "title_idioms":["Milk"],#{'              '}
                "text_all":["Milk",
                  "The true story of Harvey Milk, the first openly gay man ever elected to public office. In San Francisco in the late 1970s, Harvey Milk becomes an activist for gay rights and inspires others to join him in his fight for equal rights that should be available to all Americans.",
                  "Never blend in.",
                  "Gus Van Sant",
                  "Sean Penn",#{'                '}
                  "Drama"],
                "overview":["The true story of Harvey Milk, the first openly gay man ever elected to public office. In San Francisco in the late 1970s, Harvey Milk becomes an activist for gay rights and inspires others to join him in his fight for equal rights that should be available to all Americans."],
                "release_date":"2008-11-05T00:00:00Z",
                "vote_average":7.3,
                "vote_count":1345,
                "_version_":1798800449303740416}]
          }#{'          '}
        }
      HEREDOC

      response_body = mock_solr_response_body
      fetch_service = FetchService.new options
      docs = fetch_service.extract_docs_from_response_body_for_solr response_body
      assert_equal 1, docs.count

      doc = docs.first
      assert_equal '10139', doc[:id]
      assert_nil doc[:explain]
    end

    it 'converts docs to SnapshotDocs for SnapshotQuery' do
      fetch_service = FetchService.new options

      snapshot_query.snapshot_docs.destroy_all

      docs = []
      docs << {
        id:      '123',
        explain: { match: true, value: 13.647848 },
        fields:  { version: 1234, title: [ 'milk' ] },
      }
      docs << {
        id:      'abc',
        explain: nil,
        fields:  { version: 5678, title: [ 'eggs' ] },
      }

      results = fetch_service.setup_docs_for_query snapshot_query, docs
      assert_equal 2, results.count

      SnapshotDoc.import results

      snapshot_query.reload
      assert_equal 2, snapshot_query.snapshot_docs.count

      snapshot_doc = snapshot_query.snapshot_docs.first

      assert_nothing_raised { JSON.parse(snapshot_doc.explain) }
    end
  end

  describe 'scoring logic' do
    let(:acase)         { cases(:snapshot_case) }
    let(:atry)          { tries(:for_case_snapshot_case) }

    let(:asnapshot) { snapshots(:a_snapshot) }
    let(:snapshot_query) { snapshot_queries(:first_snapshot_query) }

    it 'runs a score' do
      assert_equal 1.0, snapshot_query.score # before running P@10

      assert_not_nil asnapshot.scorer
      assert_nil asnapshot.scorer.code
      asnapshot.scorer.code = File.readlines('./db/scorers/p@10.js', '\n').join('\n')

      fetch_service = FetchService.new options
      score_data = fetch_service.score_snapshot(asnapshot, atry)
      assert_equal 2, score_data[:queries].size
      assert_equal 0.25, score_data[:score]

      snapshot_query.reload
      assert_equal 0.5, snapshot_query.score
    end
  end
end
