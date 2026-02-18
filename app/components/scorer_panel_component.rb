# frozen_string_literal: true

# Renders a collapsible scorer panel showing rating scale, guidelines, and case-level score.
# Replaces ScorerCtrl. Integrates qscore_case (case score + sparkline) and scorer scale/guidelines.
# Per-query scores (qscore_query) remain in QueryListComponent per row.
#
# @see docs/legacy_assets_remaining.md
# @see docs/view_component_conventions.md
class ScorerPanelComponent < ApplicationComponent
  # @param scorer [Scorer, nil] Case scorer
  # @param case_id [Integer, nil] Case id for QscoreCaseComponent live-update targeting
  # @param score [Numeric, String, nil] Current case score (from last_score)
  # @param max_score [Numeric] Max scale value for color scaling
  # @param score_label [String, nil] Scorer name
  # @param scores [Array<Hash>] Score history for sparkline: [{ score:, updated_at: }, ...]
  # @param annotations [Array<Hash>] Annotations for sparkline markers
  def initialize(scorer: nil, case_id: nil, score: "?", max_score: 100, score_label: nil, scores: [], annotations: [])
    @scorer       = scorer
    @case_id      = case_id
    @score        = score
    @max_score    = max_score
    @score_label  = score_label
    @scores       = scores || []
    @annotations  = annotations || []
  end

  def scale_display
    return "—" if @scorer.blank? || @scorer.scale.blank?

    @scorer.scale.join(", ")
  end

  def scale_with_labels
    return nil if @scorer.blank?

    @scorer.scale_with_labels.presence
  end

  def guidelines_display
    return "" if scale_with_labels.blank?

    scale_with_labels.is_a?(Hash) ? scale_with_labels.to_json : scale_with_labels.to_s
  end
end
