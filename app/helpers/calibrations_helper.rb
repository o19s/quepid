# frozen_string_literal: true

module CalibrationsHelper
  # A grade as the book names it: "1 Relevant", or just "1" with no label.
  def calibration_grade value, scale
    number = (value.to_f % 1).zero? ? value.to_i : value.to_f
    label = scale.label_for(number)
    label.present? ? "#{number} #{label}" : number.to_s
  end

  def calibration_percent share
    share.nil? ? '—' : number_to_percentage(share * 100, precision: 0)
  end

  def calibration_alpha agreement
    agreement.alpha.nil? ? '—' : format('%.2f', agreement.alpha)
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
