# frozen_string_literal: true

require 'test_helper'

class QueryOptionsComponentTest < ViewComponent::TestCase
  def test_renders_trigger_and_modal
    render_inline(
      QueryOptionsComponent.new(query_id: 10, case_id: 1, options_json: { 'key' => 'value' })
    )
    assert_selector ".query-options-wrapper[data-controller='query-options']"
    assert_selector "[data-query-options-query-id-value='10']"
    assert_selector "button[data-action='click->query-options#open']", text: 'Set Options'
    assert_selector '.modal', text: /Query Options/
    assert_selector "textarea[data-query-options-target='optionsInput']"
    assert_selector "button[data-query-options-target='submitBtn']", text: 'Set Options'
  end

  def test_textarea_contains_pretty_json
    result = render_inline(
      QueryOptionsComponent.new(query_id: 1, case_id: 1, options_json: { 'a' => 1, 'b' => 2 })
    )
    textarea = result.css("textarea[data-query-options-target='optionsInput']").first
    assert textarea, 'textarea should be present'
    assert_includes textarea.text, 'a'
    assert_includes textarea.text, 'b'
  end

  def test_empty_options_renders_empty_object
    result = render_inline(
      QueryOptionsComponent.new(query_id: 1, case_id: 1, options_json: nil)
    )
    textarea = result.css("textarea[data-query-options-target='optionsInput']").first
    assert textarea, 'textarea should be present'
    assert_equal '{}', textarea.text.strip
  end
end
