# frozen_string_literal: true

# A calibration sample is drawn by pair (any pairs the reference rated) or by
# query (whole top-10 lists the reference rated in full), which also lets the
# result show how case scores would move (docs/todo/judge_calibration.md C2).
class AddUnitToCalibrationSamples < ActiveRecord::Migration[8.1]
  def change
    add_column :calibration_samples, :unit, :string, null: false, default: 'pairs'
  end
end
