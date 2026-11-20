# frozen_string_literal: true

require 'test_helper'

class CalibrationsHelperTest < ActionView::TestCase
  test 'grades alpha into bands at their floors' do
    assert_equal %w[Perfect success], calibration_alpha_band(1.0)
    assert_equal %w[Perfect success], calibration_alpha_band(0.9)
    assert_equal %w[Good teal], calibration_alpha_band(0.81)
    assert_equal %w[Moderate warning], calibration_alpha_band(0.70)
    assert_equal [ 'Not so good', 'orange' ], calibration_alpha_band(0.5)
    assert_equal %w[Bad danger], calibration_alpha_band(0.1)
    assert_equal %w[Bad danger], calibration_alpha_band(-0.3)
  end

  test 'shows alpha with its colour and a readable band name' do
    html = calibration_alpha(Struct.new(:alpha).new(0.81))

    assert_includes html, 'var(--bs-teal)'
    assert_includes html, '<span class="visually-hidden">Good: </span>0.81'
    assert_equal '—', calibration_alpha(Struct.new(:alpha).new(nil))
  end
end
