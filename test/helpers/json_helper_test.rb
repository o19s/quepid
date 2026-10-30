# frozen_string_literal: true

require 'test_helper'

class JsonHelperTest < ActionView::TestCase
  test 'formats hash as pretty-printed JSON' do
    data = { 'corpusId' => 12_345, 'enabled' => true }
    result = format_json(data)

    parsed = JSON.parse(result)
    assert_equal 12_345, parsed['corpusId']
    assert parsed['enabled']
    assert_includes result, "\n" # Check it's pretty-printed
  end

  test 'returns empty string for nil' do
    assert_equal '', format_json(nil)
  end

  test 'returns empty string for empty hash' do
    assert_equal '', format_json({})
  end

  test 'returns string unchanged' do
    json_string = '{"key": "value"}'
    assert_equal json_string, format_json(json_string)
  end

  test 'format_json_for_display pretty-prints a JSON string' do
    result = format_json_for_display('{"api-key":"abc","limit":1}')

    assert_equal "{\n  \"api-key\": \"abc\",\n  \"limit\": 1\n}", result
  end

  test 'format_json_for_display leaves a non-JSON string as-is' do
    assert_equal 'q=star wars&rows=10', format_json_for_display('q=star wars&rows=10')
    assert_equal '42', format_json_for_display('42')
  end

  test 'format_json_for_display formats a hash like format_json' do
    assert_equal format_json({ 'a' => 1 }), format_json_for_display({ 'a' => 1 })
    assert_equal '', format_json_for_display(nil)
  end
end
