# frozen_string_literal: true

# Renders a collapsible chart panel showing the case score history sparkline (Qgraph).
# Integrates QgraphComponent (Vega/D3) for the score-over-time visualization.
# Replaces the deferred chart panel; QgraphComponent was previously only embedded in QscoreCaseComponent.
#
# @see docs/view_component_conventions.md
class ChartPanelComponent < ApplicationComponent
  # @param scores [Array<Hash>] Score history: [{ score: Float, updated_at: String }, ...]
  # @param annotations [Array<Hash>] Annotations: [{ message: String, updated_at: String }, ...]
  # @param max_score [Numeric] Maximum possible score (y-axis ceiling)
  def initialize scores: [], annotations: [], max_score: 100
    @scores      = scores || []
    @annotations = annotations || []
    @max_score   = max_score
  end

  def render?
    @scores.length > 1
  end

  def scores_json
    @scores.to_json
  end

  def annotations_json
    @annotations.to_json
  end
end
