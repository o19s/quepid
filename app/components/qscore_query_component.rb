# frozen_string_literal: true

# Renders a query-level score badge with a dynamic background color.
# Replaces the Angular qscore_query component. The initial color is computed
# server-side; the Stimulus controller handles live updates from score events.
#
# @see docs/view_component_conventions.md
class QscoreQueryComponent < ApplicationComponent
  include QscoreColorable

  # @param score [Numeric, String, nil] Current query score (number, "?", "--", "zsr")
  # @param max_score [Numeric] Maximum possible score for color scaling
  # @param background_color [String, nil] Pre-computed background color (overrides score_to_color)
  # @param query_id [Integer, nil] Query id for Stimulus live-update targeting
  # @param css_class [String] Additional CSS classes on the wrapper element
  def initialize score: '?', max_score: 100, background_color: nil, query_id: nil, css_class: 'results-score'
    @score            = score
    @max_score        = max_score
    @background_color = background_color || score_to_color(score, max_score)
    @query_id         = query_id
    @css_class        = css_class
  end

  def display_score
    format_score(@score)
  end

  def inline_style
    # Strip semicolons to prevent CSS property injection
    "background-color: #{@background_color.to_s.tr(';', '')}"
  end
end
