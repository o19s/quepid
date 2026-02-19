# frozen_string_literal: true

require 'test_helper'

class MoveQueryComponentTest < ViewComponent::TestCase
  def test_renders_trigger_and_modal
    other = [ { id: 2, name: 'Other Case' }, { id: 3, name: 'Another' } ]
    render_inline(
      MoveQueryComponent.new(query_id: 10, case_id: 1, other_cases: other, try_number: 1)
    )
    assert_selector ".move-query-wrapper[data-controller='move-query']"
    assert_selector "[data-move-query-query-id-value='10']"
    assert_selector "[data-move-query-case-id-value='1']"
    assert_selector "button[data-action='click->move-query#open']", text: 'Move Query'
    assert_selector '.modal', text: /Move Query to Another Case/
    assert_selector "[data-case-id='2']", text: 'Other Case'
    assert_selector "[data-case-id='3']", text: 'Another'
    assert_selector "button[data-move-query-target='confirmBtn']"
  end

  def test_renders_empty_state_when_no_other_cases
    render_inline(
      MoveQueryComponent.new(query_id: 10, case_id: 1, other_cases: [])
    )
    assert_selector '.move-query-wrapper'
    assert_selector '.modal-body', text: /Please create another case to move this query to first/
    assert_no_selector '[data-case-id]'
  end
end
