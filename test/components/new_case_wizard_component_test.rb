# frozen_string_literal: true

require "test_helper"

class NewCaseWizardComponentTest < ViewComponent::TestCase
  def test_renders_wizard_modal
    render_inline(NewCaseWizardComponent.new(
      show: false,
      case_id: 1,
      case_name: "My Case",
      try_number: 1,
      current_user_id: 42,
      settings_path: nil
    ))

    assert_selector "[data-controller='new-case-wizard']"
    assert_selector "#newCaseWizardModal.modal"
    assert_selector ".modal-title", text: /Welcome to your new case/
    # Multi-step wizard has Next/Back/Finish buttons
    assert_selector "button[data-action='click->new-case-wizard#next']", text: /Next/
    assert_selector "button[data-action='click->new-case-wizard#finish']"
  end

  def test_renders_with_show_true
    render_inline(NewCaseWizardComponent.new(
      show: true,
      case_id: 1,
      case_name: "Test Case",
      try_number: 1,
      current_user_id: 10
    ))

    assert_selector "[data-new-case-wizard-show-value='true']"
    assert_selector "[data-new-case-wizard-user-id-value='10']"
    assert_selector "[data-new-case-wizard-case-id-value='1']"
    assert_selector "[data-new-case-wizard-try-number-value='1']"
  end

  def test_renders_all_four_steps
    render_inline(NewCaseWizardComponent.new(
      show: false,
      case_id: 1,
      case_name: "Case",
      try_number: 1
    ))

    # Step 1: Welcome (visible)
    assert_selector "[data-wizard-step='1']", text: /Get started with/
    # Step 2: Search Endpoint (hidden)
    assert_selector "[data-wizard-step='2']", text: /Connect a search endpoint/
    # Step 3: Field Spec (hidden)
    assert_selector "[data-wizard-step='3']", text: /Configure field display/
    # Step 4: First Query (hidden)
    assert_selector "[data-wizard-step='4']", text: /Add your first queries/
  end

  def test_renders_existing_endpoints_dropdown
    endpoint = search_endpoints(:one)
    endpoints = [ endpoint ]

    render_inline(NewCaseWizardComponent.new(
      show: false,
      case_id: 1,
      case_name: "Case",
      try_number: 1,
      search_endpoints: endpoints
    ))

    assert_selector "select[data-new-case-wizard-target='existingEndpoint']"
    assert_selector "option[value='#{endpoint.id}']", text: /One/
  end
end
