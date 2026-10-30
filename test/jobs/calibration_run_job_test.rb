# frozen_string_literal: true

require 'test_helper'

class CalibrationRunJobTest < ActiveJob::TestCase
  let(:book) { books(:james_bond_movies) }
  let(:reference) { users(:matt) }
  let(:judge) { users(:judge_judy) }
  let(:sample) do
    rate_pairs_for_calibration(book, reference)
    CalibrationSample.draw!(book: book, reference: reference, size: 30)
  end
  let(:calibration_run) do
    CalibrationRun.create!(sample: sample, judge: judge, judge_snapshot: CalibrationRun.snapshot_of(judge))
  end

  setup { register_default_openai_stubs }

  test 'answers every pair in the sample and finishes' do
    CalibrationRunJob.perform_now(calibration_run)

    calibration_run.reload
    assert_predicate calibration_run, :done?
    assert_equal 30, calibration_run.answers.count
    assert_not_nil calibration_run.started_at
    assert_not_nil calibration_run.finished_at
    # The stubbed judge rates everything 0; the reference alternates 0 and 1.
    assert_equal 30, calibration_run.agreement.n
  end

  test 'never writes a judgement or touches ratings' do
    sample # draw before counting

    assert_no_difference 'Judgement.count' do
      assert_no_enqueued_jobs(only: [ UpdateCaseRatingsJob, UpdateCaseJob ]) do
        CalibrationRunJob.perform_now(calibration_run)
      end
    end
  end

  test 'resuming answers only the pairs still unanswered' do
    answered = sample.sample_pairs.first(10).map(&:query_doc_pair_id)
    answered.each { |id| calibration_run.answers.create!(query_doc_pair_id: id, rating: 1) }

    CalibrationRunJob.perform_now(calibration_run)

    assert_equal 30, calibration_run.answers.count
    assert_equal(10, calibration_run.answers.where(rating: 1).count)
  end

  test 'does nothing for a run cancelled before it started' do
    calibration_run.update!(status: 'cancelled')

    CalibrationRunJob.perform_now(calibration_run)

    assert_equal 0, calibration_run.answers.count
    assert_predicate calibration_run.reload, :cancelled?
  end

  test "judges with the run's settings, not the judge's saved ones" do
    calibration_run.update!(judge_snapshot: CalibrationRun.with_settings(calibration_run.judge_snapshot,
                                                                         system_prompt: 'Only cheddar is relevant.'))

    CalibrationRunJob.perform_now(calibration_run)

    assert_requested(:post, /api\.openai\.com/, times: 30) { |request| request.body.include?('Only cheddar is relevant.') }
    assert_not_equal 'Only cheddar is relevant.', judge.reload.system_prompt
  end

  test 'a run where most calls fail ends as failed, with the error' do
    judge.update!(llm_key: OPENAI_BAD_KEY)

    CalibrationRunJob.perform_now(calibration_run)

    calibration_run.reload
    assert_predicate calibration_run, :failed?
    assert_match(/\ABOOM:/, calibration_run.error)
  end
end
