# frozen_string_literal: true

require 'test_helper'

class RunCaseEvaluationJobTest < ActiveJob::TestCase
  test 'job can be enqueued' do
    acase = cases(:one)
    atry = tries(:one)

    assert_enqueued_jobs 1 do
      RunCaseEvaluationJob.perform_later(acase, atry)
    end
  end

  test 'job is configured with bulk_processing queue' do
    assert_equal 'bulk_processing', RunCaseEvaluationJob.queue_name
  end
end
