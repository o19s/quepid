# frozen_string_literal: true

require 'test_helper'

class ExportCaseJobTest < ActiveJob::TestCase
  let(:acase) { cases(:one) }

  test 'successful export clears export_job and attaches file' do
    assert_nil acase.export_job
    assert_not acase.export_file.attached?

    perform_enqueued_jobs do
      ExportCaseJob.perform_now(acase, 'general')
    end

    acase.reload
    assert_nil acase.export_job
    assert_predicate acase.export_file, :attached?
  end

  test 'on error clears export_job and re-raises' do
    acase.update(export_job: "export started at #{Time.zone.now}")

    # Snapshot format with invalid snapshot_id raises ActiveRecord::RecordNotFound
    assert_raises(ActiveRecord::RecordNotFound) do
      ExportCaseJob.perform_now(acase, 'snapshot', snapshot_id: 999_999)
    end

    acase.reload
    assert_nil acase.export_job
  end

  test 'job is configured with bulk_processing queue' do
    assert_equal 'bulk_processing', ExportCaseJob.queue_name
  end
end
