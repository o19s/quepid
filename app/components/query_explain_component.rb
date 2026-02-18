# frozen_string_literal: true

# Renders the "Explain Query" trigger and modal showing search-engine query details:
# Params (query parameters), Parsing (parsed query), and Query Template (if templated).
# Replaces the Angular query_explain directive. Data can be passed when the query row
# is rendered after a search; otherwise a deferred message is shown.
#
# @see docs/view_component_conventions.md
class QueryExplainComponent < ApplicationComponent
  # @param query_id [String, Integer] Query id (used for modal DOM id)
  # @param params_json [String, nil] JSON string of query parameters (Solr: responseHeader.params); nil if not available
  # @param parsing_json [String, nil] JSON string of parsed query details; nil if not available
  # @param params_message [String, nil] Message when Params tab has no data (e.g. "Query parameters are not returned by the current Search Engine.")
  # @param rendered_template_json [String, nil] JSON string of rendered query template; nil if not a templated query
  def initialize(query_id:, params_json: nil, parsing_json: nil, params_message: nil, rendered_template_json: nil)
    @query_id             = query_id
    @params_json          = params_json
    @parsing_json         = parsing_json
    @params_message       = params_message
    @rendered_template_json = rendered_template_json
  end

  def modal_id
    "queryExplainModal-#{sanitized_query_id}"
  end

  def params_message
    @params_message.presence || "Query parameters are not returned by the current Search Engine."
  end

  def has_params?
    @params_json.present?
  end

  def has_parsing?
    @parsing_json.present?
  end

  def has_rendered_template?
    @rendered_template_json.present?
  end

  def params_display
    format_json(@params_json)
  end

  def parsing_display
    format_json(@parsing_json)
  end

  def rendered_template_display
    format_json(@rendered_template_json)
  end

  private

  def sanitized_query_id
    @query_id.to_s.gsub(/[^a-zA-Z0-9_-]/, "-")
  end

  def format_json(str)
    return "" if str.blank?
    parsed = JSON.parse(str)
    JSON.pretty_generate(parsed)
  rescue JSON::ParserError
    str
  end
end
