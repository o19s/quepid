# frozen_string_literal: true

require "test_helper"

class DeleteQueryComponentTest < ViewComponent::TestCase
  def test_renders_trigger_and_modal
    render_inline(
      DeleteQueryComponent.new(
        case_id: 42,
        query_id: 7,
        query_text: "Test query",
        try_number: 1
      )
    )
    assert_selector ".delete-query-wrapper[data-controller='delete-query']"
    assert_selector "[data-delete-query-case-id-value='42']"
    assert_selector "[data-delete-query-query-id-value='7']"
    assert_selector "button[data-action='click->delete-query#open']"
    assert_selector "#deleteQueryModal-7.modal"
    assert_selector ".modal-title", text: "Delete Query"
    assert_selector ".modal-body", text: /Test query/
    assert_selector "button[data-action='click->delete-query#confirm']", text: "Delete"
  end

  def test_truncates_long_query_text
    render_inline(
      DeleteQueryComponent.new(
        case_id: 1,
        query_id: 1,
        query_text: "A" * 100,
        try_number: nil
      )
    )
    # truncate(50) yields ~47 chars + "..." = 50 total; verify truncated, not full 100
    assert_selector ".modal-body", text: /A{40,}\.\.\./
  end
end
