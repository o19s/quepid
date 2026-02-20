# frozen_string_literal: true

require 'test_helper'

QueryRow = Struct.new(:id, :query_text, :options, :information_need, :notes, :updated_at, keyword_init: true)

class QueryListComponentTest < ViewComponent::TestCase
  def test_renders_empty_state
    render_inline(
      QueryListComponent.new(
        case_id:     1,
        try_number:  1,
        queries:     [],
        other_cases: []
      )
    )
    assert_selector 'turbo-frame#query_list_1'
    assert_selector ".query-list[data-controller='query-list']"
    assert_text 'No queries yet'
  end

  def test_renders_empty_state_slot_when_provided
    render_inline(
      QueryListComponent.new(
        case_id:     1,
        try_number:  1,
        queries:     [],
        other_cases: []
      )
    ) do |component|
      component.with_empty_state { 'Custom empty message' }
    end
    assert_selector 'turbo-frame#query_list_1'
    assert_text 'Custom empty message'
    assert_no_text 'No queries yet. Add one above.'
  end

  def test_renders_query_rows_with_actions
    queries = [
      QueryRow.new(id: 10, query_text: 'first query', options: nil),
      QueryRow.new(id: 11, query_text: 'second query', options: '{}')
    ]
    render_inline(
      QueryListComponent.new(
        case_id:      1,
        try_number:   1,
        queries:      queries,
        other_cases:  [ { id: 2, name: 'Other Case' } ],
        query_scores: { '10' => 75, '11' => '?' }
      )
    )
    assert_selector 'turbo-frame#query_list_1'
    assert_selector '.query-list'
    assert_selector '.query-list ul.list-group-numbered > li.list-group-item', count: 2
    assert_text 'first query'
    assert_text 'second query'
    # Query text is a clickable span (expand toggle), not a turbo-frame link
    assert_selector 'span[data-action="click->query-expand#toggle"]', count: 2
  end

  def test_renders_add_query_slot
    render_inline(
      QueryListComponent.new(
        case_id:     1,
        try_number:  1,
        queries:     [],
        other_cases: []
      )
    ) do |component|
      component.with_add_query { '<form class="add-query-form">Add query here</form>'.html_safe }
    end
    assert_selector '.add-query-form'
    assert_text 'Add query here'
  end
end
