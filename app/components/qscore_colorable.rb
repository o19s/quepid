# frozen_string_literal: true

# Shared score-to-color logic for QscoreQueryComponent and QscoreCaseComponent.
# Port of the Angular qscoreSvc.scoreToColor() function.
#
# Include this module in any component that needs to map a numeric score to an
# HSL background color string.
module QscoreColorable
  extend ActiveSupport::Concern

  SCORE_COLOR_MAP = {
    -1 => "hsl(0, 100%, 40%)",
    0  => "hsl(5, 95%, 45%)",
    1  => "hsl(10, 90%, 50%)",
    2  => "hsl(15, 85%, 55%)",
    3  => "hsl(20, 80%, 60%)",
    4  => "hsl(24, 75%, 65%)",
    5  => "hsl(28, 65%, 75%)",
    6  => "hsl(60, 55%, 65%)",
    7  => "hsl(70, 70%, 50%)",
    8  => "hsl(80, 80%, 45%)",
    9  => "hsl(90, 85%, 40%)",
    10 => "hsl(100, 90%, 35%)"
  }.freeze

  DEFAULT_COLOR = "hsl(0, 0%, 0%, 0.5)"
  PENDING_COLOR = "hsl(0, 0%, 91%)"

  # Maps a score value to an HSL color string, matching the Angular qscoreSvc.
  #
  # @param score [Numeric, String, nil] The score value (number, "?", "--", "zsr", or nil)
  # @param max_score [Numeric] The maximum possible score
  # @return [String] HSL color string
  def score_to_color(score, max_score)
    return DEFAULT_COLOR if score.nil? || score == "?"
    return PENDING_COLOR if score == "--" || score == "zsr"
    return DEFAULT_COLOR unless score.is_a?(Numeric) && max_score.is_a?(Numeric) && max_score > 0

    clamped = [ score, max_score ].min
    # Match the Angular logic: parseInt(score * 100 / max) then Math.round(n / 10)
    scaled = (clamped * 100.0 / max_score).to_i
    bucket = (scaled / 10.0).round
    SCORE_COLOR_MAP.fetch(bucket, DEFAULT_COLOR)
  end

  # Formats a score for display: numbers get 2 decimal places, everything else
  # passes through (matches the Angular scoreDisplay filter).
  #
  # @param score [Numeric, String, nil]
  # @return [String]
  def format_score(score)
    if score.is_a?(Numeric)
      format("%.2f", score)
    else
      score.to_s
    end
  end
end
