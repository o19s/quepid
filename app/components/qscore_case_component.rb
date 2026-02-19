# frozen_string_literal: true

# Renders a case-level score badge with an optional sparkline graph.
# Replaces the Angular qscore_case component. Embeds QgraphComponent when
# there are 2+ scores. The Stimulus qscore controller handles live updates.
#
# @see docs/view_component_conventions.md
class QscoreCaseComponent < ApplicationComponent
  include QscoreColorable

  # @param score [Numeric, String, nil] Current case score
  # @param max_score [Numeric] Maximum possible score for color scaling
  # @param score_label [String, nil] Scorer name displayed below the score
  # @param scores [Array<Hash>] Score history for sparkline: [{ score:, updated_at: }, ...]
  # @param annotations [Array<Hash>] Annotations for sparkline markers
  # @param background_color [String, nil] Pre-computed background color (overrides score_to_color)
  # @param case_id [Integer, nil] Case id for Stimulus live-update targeting
  # @param css_class [String] Additional CSS classes on the wrapper element
  def initialize(score: '?', max_score: 100, score_label: nil, scores: [], annotations: [],
                 background_color: nil, case_id: nil, css_class: 'case-score')
    @score            = score
    @max_score        = max_score
    @score_label      = score_label
    @scores           = scores || []
    @annotations      = annotations || []
    @background_color = background_color || score_to_color(score, max_score)
    @case_id          = case_id
    @css_class        = css_class
  end

  def display_score
    format_score(@score)
  end

  def inline_style
    # Strip semicolons to prevent CSS property injection
    "background-color: #{@background_color.to_s.tr(';', '')}"
  end

  def show_graph?
    @scores.length > 1
  end
end
