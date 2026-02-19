# frozen_string_literal: true

require 'test_helper'

class DiffComponentTest < ViewComponent::TestCase
  def test_renders_trigger_and_modal
    render_inline(DiffComponent.new(case_id: 1))
    assert_selector ".diff-wrapper[data-controller='diff']"
    assert_selector "[data-diff-case-id-value='1']"
    assert_selector "a[data-action='click->diff#open']"
    assert_selector '.modal', text: /Compare Your Search Results/
    assert_selector "button[data-action='click->diff#apply']", text: /Update Comparison/
    assert_selector "button[data-action='click->diff#clear']", text: /Clear Comparison/
  end
end
