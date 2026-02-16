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
end
