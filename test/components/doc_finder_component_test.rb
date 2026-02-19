# frozen_string_literal: true

require 'test_helper'

class DocFinderComponentTest < ViewComponent::TestCase
  def test_renders_trigger_and_modal
    render_inline(
      DocFinderComponent.new(
        case_id:      1,
        try_number:   2,
        query_id:     3,
        query_text:   'test query',
        scorer_scale: [ 0, 1, 2, 3 ]
      )
    )
    assert_selector ".doc-finder-wrapper[data-controller='doc-finder']"
    assert_selector "[data-doc-finder-case-id-value='1']"
    assert_selector "[data-doc-finder-query-id-value='3']"
    assert_selector "a[data-action='click->doc-finder#open']", text: /Find and rate missing documents/
    assert_selector '#docFinderModal.modal'
    assert_selector '.modal-title', text: /Find and Rate Missing Documents/
    assert_selector "#doc-finder-query[placeholder='Enter custom search query...']"
    assert_selector "button[data-action='click->doc-finder#rateAll'][data-rating='2']"
    assert_selector "button[data-action='click->doc-finder#resetAll']"
  end

  def test_renders_with_default_scale
    render_inline(
      DocFinderComponent.new(
        case_id:    1,
        try_number: 1,
        query_id:   1,
        query_text: 'q'
      )
    )
    assert_selector '.doc-finder-wrapper'
    assert_selector '#docFinderModal'
  end
end
