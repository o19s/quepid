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

    assert acase.snapshots.empty?

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
end
