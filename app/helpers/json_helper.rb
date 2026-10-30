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
  # read-only display. Mapper-based engines (Qdrant, Vespa) store custom headers as
  # a JSON string, and a Search API test query is often JSON. Anything that does
  # not parse as a JSON object or array is returned as-is.
  #
  # Examples:
  #   pretty_print_if_json('{"api-key":"abc"}')
  #   # => "{\n  \"api-key\": \"abc\"\n}"
  #
  #   pretty_print_if_json('q=star wars')
  #   # => 'q=star wars'
  #
  def pretty_print_if_json value
    return format_json(value) unless value.is_a?(String)

    parsed = JSON.parse(value)
    parsed.is_a?(Hash) || parsed.is_a?(Array) ? JSON.pretty_generate(parsed) : value
  rescue JSON::ParserError
    value
  end
end
