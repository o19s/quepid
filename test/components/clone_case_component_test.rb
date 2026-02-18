# frozen_string_literal: true

require "test_helper"

class CloneCaseComponentTest < ViewComponent::TestCase
  def test_renders_trigger_and_modal_with_case_data
    render_inline(
      CloneCaseComponent.new(
        case_id: 42,
        case_name: "My Case",
        tries: [ { try_number: 1, name: "Try 1" }, { try_number: 2, name: "Try 2" } ],
        last_try_number: 2
      )
    )
    assert_selector ".clone-case-wrapper[data-controller='clone-case']"
    assert_selector "[data-clone-case-case-id-value='42']"
    assert_selector "a[data-action='click->clone-case#open']", text: "Clone"
    assert_selector "#cloneCaseModal.modal"
    assert_selector ".modal-title", text: /Clone case:/
    assert_selector "#clone-case-name[placeholder='Enter new case name']"
    assert_selector "#clone-try-select option", count: 2
    assert_selector "#clone-try-select option[value='2'][selected]", count: 1
  end

  def test_renders_with_empty_tries
    render_inline(
      CloneCaseComponent.new(
        case_id: 1,
        case_name: "Empty Tries",
        tries: [],
        last_try_number: nil
      )
    )
    assert_selector ".clone-case-wrapper[data-controller='clone-case']"
    assert_selector "#cloneCaseModal"
  end
end
