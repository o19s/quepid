# frozen_string_literal: true

require "test_helper"

class ChartPanelComponentTest < ViewComponent::TestCase
  def test_renders_chart_panel_with_multiple_scores
    scores = [
      { score: 5.0, updated_at: "2026-01-01T00:00:00Z" },
      { score: 7.0, updated_at: "2026-01-02T00:00:00Z" }
    ]
    render_inline(ChartPanelComponent.new(scores: scores, max_score: 10))

    assert_selector ".chart-panel-wrapper[data-controller='chart-panel']"
    assert_selector "[data-chart-panel-target='trigger']", text: /Chart/
    assert_selector ".qgraph-wrapper[data-controller='qgraph']"
  end

  def test_does_not_render_with_single_score
    scores = [ { score: 5.0, updated_at: "2026-01-01T00:00:00Z" } ]
    result = render_inline(ChartPanelComponent.new(scores: scores, max_score: 10))

    assert_equal "", result.to_html.strip
  end

  def test_does_not_render_with_empty_scores
    result = render_inline(ChartPanelComponent.new(scores: [], max_score: 10))

    assert_equal "", result.to_html.strip
  end

  def test_includes_annotations
    scores = [
      { score: 5.0, updated_at: "2026-01-01T00:00:00Z" },
      { score: 7.0, updated_at: "2026-01-02T00:00:00Z" }
    ]
    annotations = [ { message: "Tuned", updated_at: "2026-01-01T12:00:00Z" } ]
    render_inline(ChartPanelComponent.new(scores: scores, annotations: annotations, max_score: 10))

    assert_selector "[data-qgraph-annotations-value]"
  end
end
