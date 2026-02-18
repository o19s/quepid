# frozen_string_literal: true

require "test_helper"

class QgraphComponentTest < ViewComponent::TestCase
  def test_renders_svg_container_with_data
    scores = [
      { score: 5.0, updated_at: "2026-01-01T00:00:00Z" },
      { score: 7.0, updated_at: "2026-01-02T00:00:00Z" }
    ]
    render_inline(QgraphComponent.new(scores: scores, max_score: 10))

    assert_selector ".qgraph-wrapper[data-controller='qgraph']"
    assert_selector "[data-qgraph-max-value='10']"
    assert_selector "svg[data-qgraph-target='svg']"
  end

  def test_does_not_render_with_single_score
    scores = [ { score: 5.0, updated_at: "2026-01-01T00:00:00Z" } ]
    result = render_inline(QgraphComponent.new(scores: scores, max_score: 10))

    assert_equal "", result.to_html.strip
  end

  def test_does_not_render_with_empty_scores
    result = render_inline(QgraphComponent.new(scores: [], max_score: 10))

    assert_equal "", result.to_html.strip
  end

  def test_includes_annotations_data
    scores = [
      { score: 5.0, updated_at: "2026-01-01T00:00:00Z" },
      { score: 7.0, updated_at: "2026-01-02T00:00:00Z" }
    ]
    annotations = [ { message: "Tuned boost", updated_at: "2026-01-01T12:00:00Z" } ]
    render_inline(QgraphComponent.new(scores: scores, annotations: annotations, max_score: 10))

    assert_selector "[data-qgraph-annotations-value]"
  end
end
