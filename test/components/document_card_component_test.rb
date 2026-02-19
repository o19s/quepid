# frozen_string_literal: true

require 'test_helper'

class DocumentCardComponentTest < ViewComponent::TestCase
  def test_renders_document_card
    doc = { id: 'doc1', position: 1, fields: { 'title' => 'Test Doc' } }
    render_inline(DocumentCardComponent.new(doc: doc, rating: '2', index: 0))

    assert_selector ".document-card[data-doc-id='doc1']"
    assert_selector '.badge.bg-secondary', text: '#1'
    assert_text 'Test Doc'
    assert_selector '#rating-badge-doc1'
    assert_text '2'
  end

  def test_renders_rate_badge_when_no_rating
    doc = { id: 'doc2', position: 2, fields: {} }
    render_inline(DocumentCardComponent.new(doc: doc, rating: '', index: 1))

    assert_selector '#rating-badge-doc2'
    assert_text 'Rate'
  end

  def test_renders_matches_component_when_explain_present
    doc = {
      id:       'doc3',
      position: 3,
      fields:   { 'title' => 'With Explain' },
      explain:  '{"value":1}',
    }
    render_inline(DocumentCardComponent.new(doc: doc, rating: '', index: 2))

    assert_selector "[data-controller='matches']"
    assert_selector "a[data-action='click->matches#openDebug']"
  end

  def test_omits_matches_when_no_explain
    doc = { id: 'doc4', position: 4, fields: {} }
    render_inline(DocumentCardComponent.new(doc: doc, rating: '', index: 3))

    assert_no_selector "[data-controller='matches']"
  end
end
