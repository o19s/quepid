# frozen_string_literal: true

# What the calibrated judge said about one sampled pair. Shaped like a
# judgement, but never one: it doesn't count toward ratings, case scores or
# the judging queue (docs/todo/judge_calibration.md C3).
class CalibrationAnswer < ApplicationRecord
  # LlmService#perform_safe_judgement marks a failed call this way.
  ERROR_PREFIX = 'BOOM:'

  belongs_to :run, class_name: 'CalibrationRun', foreign_key: :calibration_run_id, inverse_of: :answers,
                   counter_cache: :answers_count
  belongs_to :query_doc_pair

  scope :rateable, -> { where(unrateable: false) }
  scope :errored, -> { where('explanation LIKE ?', "#{ERROR_PREFIX}%") }
end
