# frozen_string_literal: true

require "test_helper"

QueryRow = Struct.new(:id, :query_text, :options, keyword_init: true)

class QueryListComponentTest < ViewComponent::TestCase
  def test_renders_empty_state
    render_inline(
      QueryListComponent.new(
        case_id: 1,
        try_number: 1,
        queries: [],
        other_cases: []
      )
    )
    assert_selector "turbo-frame#query_list_1"
    assert_selector ".query-list[data-controller='query-list']"
    assert_text "No queries yet"
  end

  def test_renders_empty_state_slot_when_provided
    render_inline(
      QueryListComponent.new(
        case_id: 1,
        try_number: 1,
        queries: [],
        other_cases: []
      )
    ) do |component|
      component.with_empty_state { "Custom empty message" }
    end
    assert_selector "turbo-frame#query_list_1"
    assert_text "Custom empty message"
    assert_no_text "No queries yet. Add one above."
  end

  def test_renders_query_rows_with_actions
    queries = [
      QueryRow.new(id: 10, query_text: "first query", options: nil),
      QueryRow.new(id: 11, query_text: "second query", options: "{}")
    ]
    render_inline(
      QueryListComponent.new(
        case_id: 1,
        try_number: 1,
        queries: queries,
        selected_query_id: 10,
        other_cases: [ { id: 2, name: "Other Case" } ],
        query_scores: { "10" => 75, "11" => "?" }
      )
    )
    assert_selector "turbo-frame#query_list_1"
    assert_selector ".query-list"
    assert_selector ".query-list ul.list-group-numbered > li.list-group-item", count: 2
    assert_text "first query"
    assert_text "second query"
    assert_selector "a[href*='query_id=10']"
    assert_selector ".bg-primary.bg-opacity-10", count: 1
  end
end
