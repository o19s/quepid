# frozen_string_literal: true

require "test_helper"

SelectedQuery = Struct.new(:id, :query_text, :notes, :information_need, keyword_init: true)

class ResultsPaneComponentTest < ViewComponent::TestCase
  def test_renders_prompt_when_no_query_selected
    render_inline(
      ResultsPaneComponent.new(
        case_id: 1,
        try_number: 1,
        selected_query: nil
      )
    )
    assert_selector "turbo-frame#results_pane"
    assert_selector ".results-pane[data-controller='results-pane']"
    assert_text "Select a query from the list"
  end

  def test_renders_selected_query_context
    query = SelectedQuery.new(id: 10, query_text: "test search")
    render_inline(
      ResultsPaneComponent.new(
        case_id: 1,
        try_number: 1,
        selected_query: query
      )
    )
    assert_selector "turbo-frame#results_pane"
    assert_selector ".results-pane"
    assert_text "Results for:"
    assert_text "test search"
    assert_selector "[data-results-pane-query-id-value='10']"
    assert_selector "[data-results-pane-query-text-value='test search']"
    assert_selector "[data-results-pane-target='resultsContainer']"
    assert_selector "[data-results-pane-target='diffIndicator']"
    # Detail modal is present; shared debug/expand modals are NOT (MatchesComponent handles those per-doc)
    assert_selector "[data-results-pane-target='detailModal']"
    assert_no_selector "[data-results-pane-target='debugModal']"
    assert_no_selector "[data-results-pane-target='expandModal']"
  end

  def test_renders_results_content_slot_when_provided
    query = SelectedQuery.new(id: 10, query_text: "test search")
    render_inline(
      ResultsPaneComponent.new(
        case_id: 1,
        try_number: 1,
        selected_query: query
      )
    ) do |component|
      component.with_results_content { "Custom document list placeholder" }
    end
    assert_selector "turbo-frame#results_pane"
    assert_text "Custom document list placeholder"
    assert_no_text "Results area — to be connected to search endpoint"
  end
end
