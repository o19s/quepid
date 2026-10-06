# frozen_string_literal: true

require 'test_helper'

class ApplicationJobTest < ActiveJob::TestCase
  test 'deleted GlobalID arguments are discarded while surviving ID batches still run' do
    pair = QueryDocPair.create!(query_text: 'temporary', doc_id: 'temporary', book: books(:empty_book))
    UpdateCaseRatingsJob.perform_later(pair)
    UpdateCaseRatingsJob.perform_later([ pair.id ])
    pair.destroy!

    assert_nothing_raised { perform_enqueued_jobs }
    assert_equal(2, performed_jobs.count { |job| UpdateCaseRatingsJob == job[:job] })
  end
end
