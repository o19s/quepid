# frozen_string_literal: true

# Renders the "Set Options" trigger and modal for query-specific JSON options.
# Works with the query_options Stimulus controller. Replaces the Angular query_options component.
# API: GET/PUT api/cases/:case_id/queries/:query_id/options.
#
# @see docs/view_component_conventions.md
class QueryOptionsComponent < ApplicationComponent
  # @param query_id [Integer] Query id
  # @param case_id [Integer] Case id (for API path)
  # @param options_json [String, Hash, nil] Current options as JSON string or hash (shown in textarea)
  def initialize query_id:, case_id:, options_json: nil
    @query_id    = query_id
    @case_id     = case_id
    @options_json = options_json
  end

  def options_initial
    return '' if @options_json.blank?
    return @options_json if @options_json.is_a?(String)

    @options_json.to_json
  rescue StandardError
    '{}'
  end

  def options_initial_pretty
    return '{}' if options_initial.blank?

    parsed = JSON.parse(options_initial)
    parsed.is_a?(Hash) ? JSON.pretty_generate(parsed) : options_initial
  rescue JSON::ParserError
    options_initial
  end
end
