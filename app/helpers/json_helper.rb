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
end
