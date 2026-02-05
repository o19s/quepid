# frozen_string_literal: true

# Helper methods for formatting custom_headers in views
module CustomHeadersHelper
  # Format custom_headers for form display
  # Converts Hash to pretty-printed JSON string, leaves strings as-is
  #
  # @param custom_headers [Hash, String, nil] The custom_headers value
  # @return [String] Formatted JSON string for textarea display
  #
  # Examples:
  #   format_custom_headers_for_form({"Authorization" => "Bearer token"})
  #   # => "{\n  \"Authorization\": \"Bearer token\"\n}"
  #
  #   format_custom_headers_for_form('{"key": "value"}')
  #   # => '{"key": "value"}'
  #
  #   format_custom_headers_for_form(nil)
  #   # => ""
  #
  def format_custom_headers_for_form custom_headers
    return '' if custom_headers.nil?
    return '' if custom_headers.is_a?(Hash) && custom_headers.empty?
    return custom_headers if custom_headers.is_a?(String)

    JSON.pretty_generate(custom_headers)
  end

  # Format custom_headers for readonly display
  # Same as format_custom_headers_for_form but explicitly for readonly views
  alias_method :format_custom_headers_for_display, :format_custom_headers_for_form
end
