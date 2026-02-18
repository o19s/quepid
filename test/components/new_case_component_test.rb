# frozen_string_literal: true

require "test_helper"

class NewCaseComponentTest < ViewComponent::TestCase
  def test_renders_link_to_new_case
    render_inline(NewCaseComponent.new(button_text: "Create a case"))
    path = Rails.application.routes.url_helpers.case_new_path
    assert_selector "a[href='#{path}']", text: /Create a case/
    assert_selector "a .bi-plus-lg"
  end

  def test_uses_custom_button_class
    render_inline(NewCaseComponent.new(button_class: "dropdown-item"))
    assert_selector "a.dropdown-item"
  end

  def test_block_style_adds_full_width
    render_inline(NewCaseComponent.new(block_style: true))
    assert_selector "a.w-100"
  end
end
