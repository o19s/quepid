# frozen_string_literal: true

require 'test_helper'

class CreateSnapshotFromSearchJobTest < ActiveJob::TestCase
  test 'enqueues with snapshot and user' do
    acase = cases(:one)
    atry = acase.tries.first
    snapshot = acase.snapshots.create!(name: 'Test Snapshot', scorer: acase.scorer, try: atry)

    assert_enqueued_with(job: CreateSnapshotFromSearchJob) do
      CreateSnapshotFromSearchJob.perform_later snapshot, user: users(:doug)
    end
  end

  test 'queue is bulk_processing' do
    assert_equal 'bulk_processing', CreateSnapshotFromSearchJob.new.queue_name
  end
end
