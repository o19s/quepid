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
      debug_mode:     true,
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

      acase.snapshots.first

      snapshot = fetch_service.begin(acase, atry)

      fetch_service.complete

      assert snapshot.name.starts_with?('Fetch [COMPLETED]')
      assert_equal options[:snapshot_limit], acase.snapshots.count
    end
  end

  describe 'parsing a response' do
    it 'lets you create a resopnse' do
      response = Faraday::Response.new(status: 200)
      assert_equal 200, response.status
    end
  end
end
