# frozen_string_literal: true

require 'test_helper'

class CalibrationsControllerTest < ActionDispatch::IntegrationTest
  let(:user) { users(:random) }
  let(:book) { books(:james_bond_movies) }
  let(:reference) { users(:matt) }
  let(:judge) { users(:judge_judy) }

  before do
    login_user_for_integration_test user
    register_default_openai_stubs
  end

  def start_params overrides = {}
    { calibration: { judge_id: judge.id, reference_id: reference.id, sample_size: 30, pairs: 'new' }.merge(overrides) }
  end

  def started_run
    rate_pairs_for_calibration(book, reference)
    post book_calibrations_path(book), params: start_params
    CalibrationRun.last
  end

  describe 'the page' do
    test 'explains calibration and offers the dialog, closed, when there are none yet' do
      get book_calibrations_path(book)

      assert_response :success
      assert_select 'ul.nav-underline a.nav-link.active', text: /Calibration/
      assert_select 'a', text: /Judgement Stats/, count: 0
      assert_select '#new_calibration_modal[data-calibration-dialog-open-value="false"]'
      assert_select '#calibration_judge_id option', minimum: 2
      assert_select '.card-title', text: /What it's for/
      assert_select '.card-title', text: /How to use it/
      assert_select '.card-title', text: /What you get/
      assert_select 'button[type=submit][disabled]', text: 'Start'
      assert_select '#calibration_pairs_same[disabled]'
    end

    test 'lists who can be compared against, with how many pairs each could sample' do
      get book_calibrations_path(book)

      book.calibration_references.each do |entry|
        assert_select "#calibration_reference_id option[value='#{entry[:judge].id}']" \
                      "[data-eligible-pairs='#{entry[:eligible_pairs]}']"
      end
    end

    test 'opens the dialog with the judge chosen when reached from its calibrate shortcut' do
      get book_calibrations_path(book, judge_id: judge.id)

      assert_select '#new_calibration_modal[data-calibration-dialog-open-value="true"]'
      assert_select "#calibration_judge_id option[selected][value='#{judge.id}']"
    end

    test 'lists calibrations, and offers their pairs for reuse' do
      calibration_run = started_run

      get book_calibrations_path(book)

      assert_select "#calibration-run-#{calibration_run.id}"
      assert_select 'button[data-bs-target="#calibration_about"]', text: /What is calibration/
      assert_select "select[name='calibration[sample_id]'] option[value='#{calibration_run.calibration_sample_id}']"
      assert_select '#calibration_pairs_same:not([disabled])'
    end

    test 'refuses a book the user cannot see' do
      get book_calibrations_path(books(:empty_book_2))

      assert_response :not_found
    end
  end

  describe 'starting one' do
    test 'draws a sample, starts the run and shows it' do
      rate_pairs_for_calibration(book, reference)

      assert_enqueued_with(job: CalibrationRunJob) do
        post book_calibrations_path(book), params: start_params
      end

      calibration_run = CalibrationRun.last
      assert_redirected_to book_calibration_path(book, calibration_run)
      assert_equal 30, calibration_run.sample.size
      assert_equal reference, calibration_run.reference
      assert_equal user, calibration_run.created_by
      assert_equal CalibrationRun.snapshot_of(judge), calibration_run.judge_snapshot
    end

    test 'reuses the pairs of an earlier calibration' do
      first = started_run

      assert_no_difference 'CalibrationSample.count' do
        post book_calibrations_path(book), params: start_params(pairs: 'same', sample_id: first.calibration_sample_id,
                                                                reference_id: nil, sample_size: nil)
      end

      assert_equal first.sample, CalibrationRun.last.sample
    end

    test 'refuses a reference with too few pairs' do
      rate_pairs_for_calibration(book, reference, count: 5)

      assert_no_difference 'CalibrationRun.count' do
        post book_calibrations_path(book), params: start_params
      end

      assert_redirected_to book_calibrations_path(book)
      assert_match(/needs at least 30/, flash[:alert])
    end

    test 'refuses a sample size out of range' do
      rate_pairs_for_calibration(book, reference)

      post book_calibrations_path(book), params: start_params(sample_size: 500)

      assert_equal 'Pick a sample size between 30 and 35.', flash[:alert]
    end

    test 'refuses calibrating a judge against itself' do
      rate_pairs_for_calibration(book, judge)

      post book_calibrations_path(book), params: start_params(reference_id: judge.id)

      assert_equal "A judge can't be calibrated against itself.", flash[:alert]
    end

    test "refuses a judge the user can't see" do
      rate_pairs_for_calibration(book, reference)
      hidden = AiJudge.create!(name: 'Hidden', owner: users(:doug))

      post book_calibrations_path(book), params: start_params(judge_id: hidden.id)

      assert_equal 'Choose an AI judge to calibrate.', flash[:alert]
    end
  end

  describe 'a run' do
    test 'shows its figures, matrix and one cell of pairs' do
      calibration_run = started_run
      perform_enqueued_jobs only: CalibrationRunJob

      get book_calibration_path(book, calibration_run, reference: 1, judge: 0)

      assert_response :success
      assert_select 'ul.nav-underline a.nav-link.active', count: 1, text: /Calibration/
      assert_select 'ul.nav-underline a.nav-link.active sup', text: 'β'
      assert_select 'button[data-bs-target="#calibration_about"]'
      assert_select 'button', text: /Tune and run again/
      assert_select 'a', text: /Judgement Stats/, count: 0
      assert_select 'h3', text: /#{judge.name}\s+vs\s+#{Regexp.escape(reference.fullname)}/
      assert_select '#calibration-confusion'
      assert_select 'div', text: /measured with:\s+#{judge.judge_options[:llm_model]}/
      # The stub rates every pair 0, so the cell holds every pair the reference rated 1.
      assert_select '#calibration-cell tbody tr', count: calibration_run.sample.sample_pairs.count { |pair| 1 == pair.reference_rating }
      assert_select "#rerun_modal_#{calibration_run.id} form[action=?]", rerun_book_calibration_path(book, calibration_run)
    end

    test 'can be cancelled, and resumed' do
      calibration_run = started_run

      patch cancel_book_calibration_path(book, calibration_run)
      assert_predicate calibration_run.reload, :cancelled?

      assert_enqueued_with(job: CalibrationRunJob) do
        patch resume_book_calibration_path(book, calibration_run)
      end
      assert_predicate calibration_run.reload, :queued?
    end

    test 'runs again on the same pairs as a new run' do
      calibration_run = started_run

      assert_difference 'CalibrationRun.count', 1 do
        post rerun_book_calibration_path(book, calibration_run)
      end

      assert_equal calibration_run.sample, CalibrationRun.last.sample
      assert_redirected_to book_calibration_path(book, CalibrationRun.last)
    end

    test 'runs again with a prompt and minimum confidence to try, leaving the judge alone' do
      calibration_run = started_run

      post rerun_book_calibration_path(book, calibration_run),
           params: { settings: { system_prompt: 'Be strict.', jev_min_confidence: '0.6' } }

      tuned = CalibrationRun.last
      assert_equal 'Be strict.', tuned.judge_snapshot['system_prompt']
      assert_equal '0.6', tuned.judge_snapshot['judge_options']['jev_min_confidence']
      assert_not_equal 'Be strict.', judge.reload.system_prompt
    end

    test "offers a run's settings for the next try, and applies them to the judge" do
      calibration_run = started_run
      post rerun_book_calibration_path(book, calibration_run), params: { settings: { system_prompt: 'Be strict.' } }
      tuned = CalibrationRun.last

      get book_calibration_path(book, tuned)
      assert_select "#rerun_modal_#{tuned.id} textarea", text: 'Be strict.'
      assert_select 'form[action=?]', apply_settings_book_calibration_path(book, tuned)

      patch apply_settings_book_calibration_path(book, tuned)

      assert_equal 'Be strict.', judge.reload.system_prompt
      assert_redirected_to book_calibration_path(book, tuned)
    end

    test "lists only this judge's runs on these pairs" do
      calibration_run = started_run
      other_judge = AiJudge.create!(name: 'Other Judge', owner: user)
      CalibrationRun.create!(sample: calibration_run.sample, judge: other_judge, judge_snapshot: CalibrationRun.snapshot_of(other_judge))
      post rerun_book_calibration_path(book, calibration_run), params: { settings: { system_prompt: 'Be strict.' } }

      get book_calibration_path(book, CalibrationRun.last)

      assert_select 'h5', text: "#{judge.name}'s runs on these pairs"
      assert_select 'h5 + p + div tbody tr', count: 2
      assert_select 'h5 + p + div', text: /Other Judge/, count: 0
    end

    test 'is not found through another book' do
      calibration_run = started_run

      get book_calibration_path(books(:book_of_comedy_films), calibration_run)

      assert_response :not_found
    end
  end
end
