# frozen_string_literal: true

require 'test_helper'

class DeleteCaseOptionsComponentTest < ViewComponent::TestCase
  def test_renders_trigger_and_modal_with_options
    render_inline(
      DeleteCaseOptionsComponent.new(case_id: 42, case_name: 'My Case', try_number: 2, icon_only: true)
    )
    assert_selector ".delete-case-options-wrapper[data-controller='delete-case-options']"
    assert_selector "[data-delete-case-options-case-id-value='42']"
    assert_selector "[data-delete-case-options-try-number-value='2']"
    assert_selector "a[data-action='click->delete-case-options#open']"
    assert_selector '#deleteCaseOptionsModal.modal'
    assert_selector '.modal-title', text: /Delete Options for Case:/
    assert_selector "label[for='opt-delete-queries']", text: 'Delete All Queries'
    assert_selector "label[for='opt-archive']", text: 'Archive Case'
    assert_selector "label[for='opt-delete-case']", text: 'Delete Case'
    assert_selector "button[data-delete-case-options-target='confirmBtn']"
  end
end
