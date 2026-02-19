# frozen_string_literal: true

require 'test_helper'

class QscoreCaseComponentTest < ViewComponent::TestCase
  def test_renders_case_score_with_label
    render_inline(QscoreCaseComponent.new(
                    score:       7.25,
                    max_score:   10,
                    score_label: 'nDCG@10',
                    case_id:     1
                  ))

    assert_selector ".qscore-case[data-controller='qscore']"
    assert_selector '.header-rating'
    assert_selector '.scorable-score', text: '7.25'
    assert_selector '.query-score-label', text: 'nDCG@10'
  end

  def test_renders_unknown_score_without_label
    render_inline(QscoreCaseComponent.new(score: '?', max_score: 10))

    assert_selector '.scorable-score', text: '?'
    assert_no_selector '.query-score-label'
  end

  def test_embeds_qgraph_when_multiple_scores
    scores = [
      { score: 5.0, updated_at: '2026-01-01T00:00:00Z' },
      { score: 7.0, updated_at: '2026-01-02T00:00:00Z' },
      { score: 8.5, updated_at: '2026-01-03T00:00:00Z' }
    ]
    render_inline(QscoreCaseComponent.new(
                    score:     8.5,
                    max_score: 10,
                    scores:    scores
                  ))

    assert_selector ".qgraph-wrapper[data-controller='qgraph']"
    assert_selector "svg[data-qgraph-target='svg']"
  end

  def test_hides_qgraph_with_single_score
    scores = [ { score: 5.0, updated_at: '2026-01-01T00:00:00Z' } ]
    render_inline(QscoreCaseComponent.new(
                    score:     5.0,
                    max_score: 10,
                    scores:    scores
                  ))

    assert_no_selector '.qgraph-wrapper'
  end

  def test_hides_qgraph_with_no_scores
    render_inline(QscoreCaseComponent.new(score: '?', max_score: 10, scores: []))

    assert_no_selector '.qgraph-wrapper'
  end

  def test_passes_case_id_to_stimulus
    render_inline(QscoreCaseComponent.new(score: 5, max_score: 10, case_id: 99))

    assert_selector "[data-qscore-case-id-value='99']"
  end
end
