# frozen_string_literal: true

module JsonHelper
  # Format JSON data for display in forms and views
  # Converts Hash to pretty-printed JSON string, leaves strings as-is
  #
  # @param json_data [Hash, String, nil] The JSON data value
  # @return [String] Formatted JSON string for textarea display
  #
  # Examples:
  #   format_json({"corpusId" => 12345})
  #   # => "{\n  \"corpusId\": 12345\n}"
  #
  #   format_json('{"key": "value"}')
  #   # => '{"key": "value"}'
  #
  #   format_json(nil)
  #   # => ""
  #
  def format_json json_data
    return '' if json_data.nil?
    return '' if json_data.is_a?(Hash) && json_data.empty?
    return json_data if json_data.is_a?(String)

    JSON.pretty_generate(json_data)
  end

  # Like format_json, but accepts any value: a String that holds JSON is pretty-printed too, for
  # read-only display - a Search API test query is often JSON, but may also be plain text.
  # Anything that does not parse as a JSON object or array is returned as-is.
  #
  # Examples:
  #   format_for_display('{"api-key":"abc"}')
  #   # => "{\n  \"api-key\": \"abc\"\n}"
  #
  #   format_for_display('q=star wars')
  #   # => 'q=star wars'
  #
  def format_for_display value
    return format_json(value) unless value.is_a?(String)
    return value unless value.lstrip.start_with?('{', '[')

    parsed = JSON.parse(value)
    parsed.is_a?(Hash) || parsed.is_a?(Array) ? JSON.pretty_generate(parsed) : value
  rescue JSON::ParserError
    value
  end
end
