# frozen_string_literal: true

require 'test_helper'

class CustomHeadersHelperTest < ActionView::TestCase
  test 'formats hash with pretty JSON' do
    headers = { 'Authorization' => 'Bearer token', 'X-API-Key' => 'key123' }
    result = format_custom_headers_for_form(headers)

    assert_includes result, '"Authorization"'
    assert_includes result, '"Bearer token"'
    assert_includes result, '"X-API-Key"'
    assert_includes result, '"key123"'
    # Check it's pretty-printed (has newlines)
    assert_includes result, "\n"
  end

  test 'returns empty string for nil' do
    assert_equal '', format_custom_headers_for_form(nil)
  end

  test 'returns empty string for empty hash' do
    assert_equal '', format_custom_headers_for_form({})
  end

  test 'returns string unchanged' do
    json_string = '{"Authorization": "Bearer token"}'
    assert_equal json_string, format_custom_headers_for_form(json_string)
  end

  test 'handles hash with string values' do
    headers = { 'X-Count' => '3', 'X-Debug' => 'true' }
    result = format_custom_headers_for_form(headers)

    assert_includes result, '"X-Count"'
    assert_includes result, '"3"'
    assert_includes result, '"X-Debug"'
    assert_includes result, '"true"'
  end

  test 'format_custom_headers_for_display is alias of format_custom_headers_for_form' do
    headers = { 'Authorization' => 'Bearer token' }
    form_result = format_custom_headers_for_form(headers)
    display_result = format_custom_headers_for_display(headers)

    assert_equal form_result, display_result
  end

  test 'handles complex nested structure' do
    headers = {
      'Authorization' => 'Bearer token123',
      'X-Custom'      => 'value with spaces',
      'Accept'        => 'application/json, text/html',
    }
    result = format_custom_headers_for_form(headers)

    # Verify it's valid JSON
    parsed = JSON.parse(result)
    assert_equal 'Bearer token123', parsed['Authorization']
    assert_equal 'value with spaces', parsed['X-Custom']
    assert_equal 'application/json, text/html', parsed['Accept']
  end
end
