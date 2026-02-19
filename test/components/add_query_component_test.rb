# frozen_string_literal: true

require 'test_helper'

class AddQueryComponentTest < ViewComponent::TestCase
  def test_renders_form_with_input_and_submit
    render_inline(AddQueryComponent.new(case_id: 42, can_add_queries: true))
    assert_selector "form[data-controller='add-query'][data-add-query-case-id-value='42']"
    assert_selector "input#add-query[placeholder='Add a query to this case']"
    assert_selector "input#add-query-submit.btn.btn-success[value='Add query']"
    assert_selector "span[data-add-query-target='spinner']"
  end

  def test_disabled_state_when_can_add_queries_false
    render_inline(AddQueryComponent.new(case_id: 1, can_add_queries: false))
    assert_selector 'input#add-query-submit[disabled]'
    assert_selector "input#add-query[placeholder='Adding queries is not supported']"
  end

  def test_custom_placeholder
    render_inline(AddQueryComponent.new(case_id: 1, placeholder: 'Enter query text'))
    assert_selector "input#add-query[placeholder='Enter query text']"
  end
end
