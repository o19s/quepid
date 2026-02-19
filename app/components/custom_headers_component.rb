# frozen_string_literal: true

# Renders the "Custom Headers" trigger and modal for editing HTTP headers sent to the search endpoint.
# Replaces Angular CustomHeadersCtrl. Part of try/settings flow.
#
# API: PUT api/search_endpoints/:id with { search_endpoint: { custom_headers } }
#
# @see docs/legacy_assets_remaining.md (CustomHeadersCtrl migration)
class CustomHeadersComponent < ApplicationComponent
  # @param search_endpoint_id [Integer] Search endpoint id (for API)
  # @param custom_headers [Hash, String, nil] Current custom headers (JSON object or string)
  def initialize search_endpoint_id:, custom_headers: nil
    @search_endpoint_id = search_endpoint_id
    @custom_headers = custom_headers
  end

  def custom_headers_initial
    return '' if @custom_headers.blank?
    return @custom_headers if @custom_headers.is_a?(String)

    @custom_headers.to_json
  rescue StandardError
    '{}'
  end

  def custom_headers_pretty
    return '{}' if custom_headers_initial.blank?

    parsed = JSON.parse(custom_headers_initial)
    parsed.is_a?(Hash) ? JSON.pretty_generate(parsed) : custom_headers_initial
  rescue JSON::ParserError
    custom_headers_initial
  end
end
