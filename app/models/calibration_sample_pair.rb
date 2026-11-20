# frozen_string_literal: true

class CalibrationSamplePair < ApplicationRecord
  belongs_to :sample, class_name: 'CalibrationSample', foreign_key: :calibration_sample_id, inverse_of: :sample_pairs
  belongs_to :query_doc_pair
end
