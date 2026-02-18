# frozen_string_literal: true

require "test_helper"

class MatchesComponentTest < ViewComponent::TestCase
  def test_renders_explain_text
    render_inline(MatchesComponent.new(
      doc_id: "doc-123",
      explain_text: "3.14 = weight(title:ruby)"
    ))

    assert_selector "[data-controller='matches']"
    assert_selector ".doc-score-explanation pre", text: "3.14 = weight(title:ruby)"
  end

  def test_renders_debug_button_and_modal
    render_inline(MatchesComponent.new(
      doc_id: "doc-456",
      doc_title: "My Document",
      explain_raw: '{"value": 3.14}'
    ))

    assert_selector "a[data-action='click->matches#openDebug']", text: "Debug"
    assert_selector "#matchesDebugModal-doc-456.modal"
    assert_selector ".modal-title", text: /Debug Explain for My Document/
    assert_selector ".explain-raw", text: '{"value": 3.14}'
  end

  def test_renders_expand_button_and_modal
    render_inline(MatchesComponent.new(
      doc_id: "doc-789",
      doc_score: 9.5,
      explain_text: "some explain text"
    ))

    # Expand is handled by ExpandContentComponent
    assert_selector "[data-controller='expand-content']"
    assert_selector "button[data-action='click->expand-content#open']", text: /Expand/
    assert_selector "i.bi.bi-arrows-angle-expand"
    assert_selector "#matchesExpandModal-doc-789.modal"
    assert_selector "#matchesExpandModal-doc-789 .modal-title", text: "Relevancy Score: 9.5"
  end

  def test_uses_doc_id_when_title_absent
    render_inline(MatchesComponent.new(
      doc_id: "doc-abc",
      explain_raw: "{}"
    ))

    assert_selector ".modal-title", text: /Debug Explain for doc-abc/
  end

  def test_sanitizes_doc_id_with_special_characters
    render_inline(MatchesComponent.new(
      doc_id: "http://example.com/doc/42",
      explain_text: "1.0 = match"
    ))

    # Special chars replaced with hyphens for valid HTML id
    assert_selector "#matchesDebugModal-http---example-com-doc-42.modal"
    # Display still uses original doc_id
    assert_selector ".modal-title", text: /id:http:\/\/example\.com\/doc\/42/
  end
end
