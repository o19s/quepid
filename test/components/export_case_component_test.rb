# frozen_string_literal: true

require 'test_helper'

class ExportCaseComponentTest < ViewComponent::TestCase
  def test_renders_trigger_and_modal_with_case_data
    render_inline(
      ExportCaseComponent.new(
        case_id:                  42,
        case_name:                'My Case',
        icon_only:                true,
        supports_detailed_export: true
      )
    )
    assert_selector ".export-case-wrapper[data-controller='export-case']"
    assert_selector "[data-export-case-case-id-value='42']"
    assert_selector "a[data-action='click->export-case#open']"
    assert_selector '#exportCaseModal.modal'
    assert_selector '.modal-title', text: /Export Case:/
    assert_selector "input[name='exportSelection'][value='information_need']"
    assert_selector "input[name='exportSelection'][value='quepid']"
    assert_selector "button[data-export-case-target='submitBtn']", text: 'Export'
  end

  def test_icon_only_false_renders_text_link
    render_inline(
      ExportCaseComponent.new(
        case_id:                  1,
        case_name:                'Test',
        icon_only:                false,
        supports_detailed_export: false
      )
    )
    assert_selector '.export-case-wrapper'
    assert_text 'Export'
  end
end
