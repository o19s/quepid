# frozen_string_literal: true

require 'test_helper'

class QscoreQueryComponentTest < ViewComponent::TestCase
  def test_renders_score_with_color
    render_inline(QscoreQueryComponent.new(score: 8.5, max_score: 10))

    assert_selector ".qscore-query[data-controller='qscore']"
    assert_selector '.overall-rating'
    assert_selector '.scorable-score', text: '8.50'
  end

  def test_renders_unknown_score
    render_inline(QscoreQueryComponent.new(score: '?', max_score: 10))

    assert_selector '.scorable-score', text: '?'
  end

  def test_renders_pending_score
    render_inline(QscoreQueryComponent.new(score: '--', max_score: 10))

    assert_selector '.scorable-score', text: '--'
  end

  def test_renders_zsr_score
    render_inline(QscoreQueryComponent.new(score: 'zsr', max_score: 10))

    assert_selector '.scorable-score', text: 'zsr'
  end

  def test_applies_custom_css_class
    render_inline(QscoreQueryComponent.new(score: 5, max_score: 10, css_class: 'diff-score'))

    assert_selector '.qscore-query.diff-score'
  end

  def test_passes_query_id_to_stimulus
    render_inline(QscoreQueryComponent.new(score: 5, max_score: 10, query_id: 42))

    assert_selector "[data-qscore-query-id-value='42']"
  end

  def test_overrides_color_with_background_color
    render_inline(QscoreQueryComponent.new(score: 5, max_score: 10, background_color: 'red'))

    assert_selector ".overall-rating[style*='red']"
  end
end
