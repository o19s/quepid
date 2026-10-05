# frozen_string_literal: true

require 'test_helper'

class CalibrationRunTest < ActiveSupport::TestCase
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

  it "compares rateable answers with the reference's ratings as drawn" do
    sample.sample_pairs.each_with_index do |sample_pair, i|
      calibration_run.answers.create!(query_doc_pair_id: sample_pair.query_doc_pair_id,
                                      rating:            i < 3 ? 1 - sample_pair.reference_rating : sample_pair.reference_rating)
    end
    calibration_run.answers.first.update!(unrateable: true, rating: nil)

    agreement = calibration_run.agreement

    assert_equal 29, agreement.n
    assert_in_delta 27.0 / 29, agreement.exact_share
    assert_equal 1, calibration_run.unrateable_count
  end

  it 'is stale once the judge changes' do
    assert_not calibration_run.stale?

    judge.update!(system_prompt: 'Be stricter.')

    assert_predicate calibration_run.reload, :stale?
  end

  it 'names what changed between two runs of a judge' do
    first = calibration_run
    judge.update!(system_prompt: 'Be stricter.')
    judge.judge_options = judge.judge_options.merge(llm_model: 'gpt-4.1')
    judge.save!
    second = CalibrationRun.create!(sample: sample, judge: judge, judge_snapshot: CalibrationRun.snapshot_of(judge))

    assert_equal %w[prompt model], second.changes_since(first)
    assert_empty first.changes_since(first)
  end

  describe 'tuning' do
    let(:jev_snapshot) do
      { 'system_prompt' => 'Rate it.', 'judge_options' => { 'llm_provider' => 'typesafe_jev', 'jev_min_confidence' => '0.8' } }
    end

    it 'overrides the prompt and minimum confidence, and nothing else' do
      tuned = CalibrationRun.with_settings(jev_snapshot, system_prompt: 'Be strict.',
                                                         options:       { 'jev_min_confidence' => '0.5', 'llm_model' => 'x' })

      assert_equal 'Be strict.', tuned['system_prompt']
      assert_equal({ 'llm_provider' => 'typesafe_jev', 'jev_min_confidence' => '0.5' }, tuned['judge_options'])
      assert_equal '0.8', jev_snapshot['judge_options']['jev_min_confidence'], 'leaves the original alone'
    end

    it 'clears the minimum confidence when it is left blank' do
      tuned = CalibrationRun.with_settings(jev_snapshot, options: { 'jev_min_confidence' => '' })

      assert_not tuned['judge_options'].key?('jev_min_confidence')
    end

    it 'judges with its own settings in memory, without changing the judge' do
      calibration_run.update!(judge_snapshot: CalibrationRun.with_settings(calibration_run.judge_snapshot, system_prompt: 'Be strict.'))

      tuned = calibration_run.tuned_judge

      assert_equal 'Be strict.', tuned.system_prompt
      assert_equal judge.id, tuned.id
      assert_not_equal 'Be strict.', judge.reload.system_prompt
      assert_equal [ 'prompt' ], calibration_run.changes_since_judge
      assert_predicate calibration_run, :stale?
    end

    it 'applies its settings to the judge' do
      calibration_run.update!(judge_snapshot: CalibrationRun.with_settings(calibration_run.judge_snapshot, system_prompt: 'Be strict.'))

      calibration_run.apply_settings_to_judge!

      assert_equal 'Be strict.', judge.reload.system_prompt
      assert_not calibration_run.reload.stale?
    end
  end

  it 'lists the pairs not answered yet' do
    answered = sample.sample_pairs.first
    calibration_run.answers.create!(query_doc_pair_id: answered.query_doc_pair_id, rating: 1)

    assert_equal 29, calibration_run.pending_pairs.count
    assert_not_includes calibration_run.pending_pairs.pluck(:id), answered.query_doc_pair_id
  end
end
