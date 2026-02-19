# frozen_string_literal: true

require 'test_helper'

class CustomHeadersComponentTest < ViewComponent::TestCase
  def test_renders_custom_headers_trigger
    render_inline(CustomHeadersComponent.new(
                    search_endpoint_id: 1,
                    custom_headers:     { 'Authorization' => 'ApiKey xxx' }
                  ))

    assert_selector '.custom-headers-wrapper'
    assert_selector "a[data-action='click->custom-headers#open']"
    assert_selector '#customHeadersModal'
  end

  def test_custom_headers_pretty_with_hash
    component = CustomHeadersComponent.new(search_endpoint_id: 1, custom_headers: { 'X-Key' => 'value' })
    assert_includes component.custom_headers_pretty, 'X-Key'
    assert_includes component.custom_headers_pretty, 'value'
  end

  def test_custom_headers_pretty_with_empty
    component = CustomHeadersComponent.new(search_endpoint_id: 1, custom_headers: nil)
    assert_equal '{}', component.custom_headers_pretty
  end
end
