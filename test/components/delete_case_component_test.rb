# frozen_string_literal: true

require "test_helper"

class DeleteCaseComponentTest < ViewComponent::TestCase
  def test_renders_trigger_and_modal
    render_inline(DeleteCaseComponent.new(case_id: 42, case_name: "My Case"))
    assert_selector ".delete-case-wrapper[data-controller='delete-case']"
    assert_selector "[data-delete-case-case-id-value='42']"
    assert_selector "a[data-action='click->delete-case#open']"
    assert_selector "#deleteCaseModal.modal"
    assert_selector ".modal-title", text: "Delete This Case"
    assert_selector "button[data-action='click->delete-case#confirm']", text: "Delete"
  end
end
