# frozen_string_literal: true

module CalibrationsHelper
  # A grade as the book names it: "1 Relevant", or just "1" with no label.
  def calibration_grade value, scale
    number = (value.to_f % 1).zero? ? value.to_i : value.to_f
    label = scale.label_for(number)
    label.present? ? "#{number} #{label}" : number.to_s
  end

  # This judge's tuning history on the run's pairs: other judges' runs compare
  # something else. Figures are shown for finished runs only, so only theirs
  # need answers.
  def calibration_sample_runs run
    runs = run.sample.runs.where(judge_id: run.judge_id).order(:id).to_a
    ActiveRecord::Associations::Preloader.new(records: runs.reject(&:active?), associations: :answers).call
    runs
  end

  # When the server rendered a live-updated element, for stale_stream_guard:
  # milliseconds, so updates rendered in one second still order.
  def calibration_rendered_at
    (Time.current.to_f * 1000).to_i
  end

  def calibration_percent share
    share.nil? ? '—' : number_to_percentage(share * 100, precision: 0)
  end

  # α bands, best first. 0.8 and 0.667 are Krippendorff's own cut-offs (reliable / lowest usable).
  CALIBRATION_ALPHA_BANDS = [
    [ 0.9, 'Perfect', 'success' ],
    [ 0.8, 'Good', 'teal' ],
    [ 0.667, 'Moderate', 'warning' ],
    [ 0.4, 'Not so good', 'orange' ],
    [ -Float::INFINITY, 'Bad', 'danger' ]
  ].freeze

  def calibration_alpha_band alpha
    CALIBRATION_ALPHA_BANDS.find { |floor, _, _| alpha >= floor }.drop(1)
  end

  def calibration_alpha agreement
    return '—' if agreement.alpha.nil?

    label, color = calibration_alpha_band(agreement.alpha)
    safe_join([
                content_tag(:i, nil, class: 'bi bi-circle-fill me-1 small', style: "color: var(--bs-#{color})",
                                     title: label, 'aria-hidden': true),
                content_tag(:span, "#{label}: ", class: 'visually-hidden'),
                format('%.2f', agreement.alpha)
              ])
  end

  # "openai rates 0.3 lower than Osc Team Member, on average" -- which way the
  # judge leans, on the book's scale.
  def calibration_lean agreement, judge_name, reference_name
    difference = agreement.mean_difference
    return nil if difference.nil?
    return "#{judge_name} doesn't lean either way against #{reference_name}." if difference.abs < 0.05

    direction = difference.negative? ? 'lower' : 'higher'
    "#{judge_name} rates #{format('%.1f', difference.abs)} #{direction} than #{reference_name}, on average."
  end

  # The judge settings a run was measured with, from its snapshot:
  # "jev-latest · minimum confidence 0.8".
  def calibration_settings run
    options = (run.judge_snapshot || {})['judge_options'] || {}
    parts = [ options['llm_model'].presence ]
    parts << "minimum confidence #{options['jev_min_confidence']}" if options['jev_min_confidence'].present?
    parts.compact.join(' · ')
  end

  def calibration_judge_name user
    user.ai_judge? ? user.name : user.fullname
  end

  def calibration_status_badge run
    css = { 'queued' => 'secondary', 'running' => 'primary', 'done' => 'success',
            'cancelled' => 'warning', 'failed' => 'danger' }.fetch(run.status)
    content_tag(:span, run.status.capitalize, class: "badge text-bg-#{css}")
  end
end
