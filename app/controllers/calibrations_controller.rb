# frozen_string_literal: true

# A book's calibrations: run an AI judge on a sample of pairs another judge
# has rated, and compare the two (docs/todo/judge_calibration.md). A
# "calibration" in the URL is one CalibrationRun.
class CalibrationsController < ApplicationController
  before_action :set_book
  before_action :set_run, only: [ :show, :cancel, :resume, :rerun, :apply_settings ]

  def index
    @runs = CalibrationRun.for_book(@book).includes(:judge, sample: [ :reference, :book ]).order(id: :desc)
    @judges = visible_ai_judges
    @references = @book.calibration_references
    @samples = @book.calibration_samples.includes(:reference, runs: :judge).order(id: :desc)
    @preselected_judge_id = params[:judge_id].to_i if params[:judge_id].present?
  end

  def show
    @sample = @run.sample
    @cell = cell_param
  end

  def create
    judge = visible_ai_judges.find { |candidate| candidate.id == calibration_params[:judge_id].to_i }
    return refuse('Choose an AI judge to calibrate.') unless judge

    sample = 'same' == calibration_params[:pairs] ? existing_sample : new_sample
    return if performed?
    return refuse("A judge can't be calibrated against itself.") if sample.reference_id == judge.id

    run = CalibrationRun.start!(sample: sample, judge: judge, created_by: current_user)
    redirect_to book_calibration_path(@book, run),
                notice: "Calibrating #{judge.name} against #{sample.reference.name} on #{sample.size} pairs."
  end

  def cancel
    @run.update!(status: 'cancelled', finished_at: Time.current) if @run.active?
    redirect_to book_calibration_path(@book, @run), notice: 'Calibration cancelled.'
  end

  # Picks up the pairs a cancelled or failed run didn't answer.
  def resume
    stopped = @run.cancelled? || @run.failed?
    return redirect_to book_calibration_path(@book, @run), alert: 'Only a stopped calibration can be resumed.' unless stopped

    @run.update!(status: 'queued', finished_at: nil, error: nil)
    CalibrationRunJob.perform_later(@run)
    redirect_to book_calibration_path(@book, @run), notice: 'Calibration resumed.'
  end

  # The same judge on the same pairs: with the prompt and minimum confidence
  # given (tuning), or as the judge is saved now. Trying settings here never
  # changes the judge; #apply_settings does.
  def rerun
    judge = visible_judge(@run)
    return redirect_to book_calibration_path(@book, @run), alert: "You can't run #{@run.judge.name}." unless judge

    snapshot = CalibrationRun.snapshot_of(judge)
    if (settings = tuning_params).present?
      snapshot = CalibrationRun.with_settings(snapshot, system_prompt: settings[:system_prompt],
                                                        options:       settings.except(:system_prompt).to_h)
    end
    run = CalibrationRun.start!(sample: @run.sample, judge: judge, created_by: current_user, snapshot: snapshot)
    redirect_to book_calibration_path(@book, run), notice: "Calibrating #{judge.name} again on the same pairs."
  end

  # Makes a run's prompt and options the judge's own.
  def apply_settings
    judge = visible_judge(@run)
    return redirect_to book_calibration_path(@book, @run), alert: "You can't change #{@run.judge.name}." unless judge

    @run.apply_settings_to_judge!
    redirect_to book_calibration_path(@book, @run), notice: "#{judge.name} now uses this run's prompt and settings."
  end

  private

  def set_run
    @run = CalibrationRun.for_book(@book).find(params.expect(:id))
  end

  def calibration_params
    params.expect(calibration: [ :judge_id, :reference_id, :sample_size, :pairs, :sample_id ])
  end

  def tuning_params
    params.fetch(:settings, {}).permit(:system_prompt, *CalibrationRun::TUNABLE_OPTIONS)
  end

  def visible_judge run
    visible_ai_judges.find { |candidate| candidate.id == run.judge_id }
  end

  def visible_ai_judges
    @visible_ai_judges ||= AiJudge.for_user(current_user).order(:name).to_a.uniq
  end

  def existing_sample
    sample = @book.calibration_samples.find_by(id: calibration_params[:sample_id])
    sample || refuse('Choose the earlier calibration whose pairs to use.')
  end

  def new_sample
    reference = @book.calibration_references.find { |entry| entry[:judge].id == calibration_params[:reference_id].to_i }
    return refuse('Choose a judge who has rated pairs on this book to compare against.') unless reference

    eligible = reference[:eligible_pairs]
    upper = [ eligible, CalibrationSample::MAX_SIZE ].min
    size = Integer(calibration_params[:sample_size], exception: false)
    if eligible < CalibrationSample::MIN_SIZE
      return refuse("#{reference[:judge].name} has rated only #{eligible} pairs on this book's scale; " \
                    "a calibration needs at least #{CalibrationSample::MIN_SIZE}.")
    end
    return refuse("Pick a sample size between #{CalibrationSample::MIN_SIZE} and #{upper}.") unless size&.between?(CalibrationSample::MIN_SIZE, upper)

    CalibrationSample.draw!(book: @book, reference: reference[:judge], size: size, created_by: current_user)
  end

  def refuse message
    redirect_to book_calibrations_path(@book), alert: message
    nil
  end

  # ?reference=1&judge=0 picks one cell of the confusion matrix.
  def cell_param
    return nil unless params[:reference].present? && params[:judge].present?

    [ params[:reference].to_f, params[:judge].to_f ]
  end
end
