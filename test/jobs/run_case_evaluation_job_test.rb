# frozen_string_literal: true

require 'test_helper'

class RunCaseEvaluationJobTest < ActiveJob::TestCase
  test 'job can be run' do
    WebMock.allow_net_connect!
    acase = cases(:one)
    atry = tries(:one)
    scorer = scorers(:'p@10')
    search_endpoint = search_endpoints(:edinburgh_uni_search_api)

    acase.scorer = scorer
    acase.save!

    atry.search_endpoint = search_endpoint
    atry.save!

    assert_empty acase.snapshots

    assert_difference 'acase.snapshots.count', 1 do
      assert_difference 'acase.scores.count', 1 do
        perform_enqueued_jobs do
          RunCaseEvaluationJob.perform_now(acase, atry)
        end
      end
    end
  end

  test 'job is configured with bulk_processing queue' do
    assert_equal 'bulk_processing', RunCaseEvaluationJob.queue_name
  end

  test 'a mapper that throws records an error on the snapshot query instead of a silent zero-result' do
    # 'job can be run' (above) calls WebMock.allow_net_connect! with no teardown, so
    # depending on test order this run may inherit that global state - pin it back so an
    # unmatched stub fails loudly instead of silently attempting a real connection.
    WebMock.disable_net_connect!(allow_localhost: true)

    acase = cases(:one)
    atry = tries(:one)
    scorer = scorers(:'p@10')

    # A response shape the mapper doesn't expect (no "root" key), simulating e.g. an
    # error payload or a mismatched schema - realistic conditions for a mapper to throw.
    stub_request(:get, %r{\Ahttp://test\.com/vespa-throws/search})
      .to_return(status: 200, body: '{"unexpected":"shape"}', headers: { 'Content-Type' => 'application/json' })

    search_endpoint = SearchEndpoint.create!(
      name:          'Throws',
      search_engine: 'searchapi',
      endpoint_url:  'http://test.com/vespa-throws/search',
      api_method:    'GET',
      mapper_code:   <<~JS
        numberOfResultsMapper = function(data) {
          return data.root.fields.totalCount;
        }
        docsMapper = function(data) {
          return data.root.children.map(function(child) { return child.fields; });
        }
      JS
    )

    acase.scorer = scorer
    acase.save!

    atry.query_params = 'q=#$query##'
    atry.search_endpoint = search_endpoint
    atry.save!

    assert_equal 2, acase.queries.count

    perform_enqueued_jobs do
      RunCaseEvaluationJob.perform_now(acase, atry)
    end

    snapshot_queries = acase.snapshots.last.snapshot_queries
    assert_equal 2, snapshot_queries.count

    snapshot_queries.each do |snapshot_query|
      assert_equal 0, snapshot_query.number_of_results
      assert_includes snapshot_query.error, 'JavaScript execution error'
    end
  end
end
