# frozen_string_literal: true

# Renders a collapsible settings panel showing current try info (search URL,
# engine) and editable query params (try settings). Replaces SettingsCtrl,
# CurrSettingsCtrl, and QueryParamsPanelComponent.
#
# @see docs/legacy_assets_remaining.md
# @see docs/view_component_conventions.md
class SettingsPanelComponent < ApplicationComponent
  # @param try [Try, nil] Current try (search configuration)
  # @param search_endpoint [SearchEndpoint, nil] Try's search endpoint
  # @param search_endpoint_edit_path [String, nil] URL to edit the search endpoint (caller provides)
  # @param case_id [Integer, nil] Case id for API URL construction
  # @param tries [Array<Try>, nil] All tries for the case (for history browser)
  def initialize(try: nil, search_endpoint: nil, search_endpoint_edit_path: nil, case_id: nil, tries: nil, search_endpoints: nil)
    @try                      = try
    @search_endpoint          = search_endpoint || try&.search_endpoint
    @search_endpoint_edit_path = search_endpoint_edit_path
    @case_id                  = case_id
    @tries                    = tries || []
    @search_endpoints         = search_endpoints || []
  end

  def search_endpoints
    @search_endpoints
  end

  def current_search_endpoint_id
    @search_endpoint&.id
  end

  def query_params_full
    return "" if @try.blank? || @try.query_params.blank?

    @try.query_params.to_s
  end

  def escape_query?
    @try&.escape_query || false
  end

  def number_of_rows
    @try&.number_of_rows || 10
  end

  def try_name
    @try&.name.presence || "Try #{@try&.try_number}"
  end

  def search_engine
    @search_endpoint&.search_engine || "—"
  end

  def search_url
    return "—" if @search_endpoint.blank?

    @search_endpoint.endpoint_url.presence || "—"
  end

  # Curator variables as JSON for Stimulus value binding.
  def curator_vars_json
    return "{}" if @try.blank?

    @try.curator_vars_map.transform_keys(&:to_s).to_json
  end

  def tries
    @tries
  end

  # Compare adjacent tries and return a hash of try_number => [changed fields]
  def try_diffs
    return {} if @tries.size < 2

    sorted = @tries.sort_by(&:try_number)
    diffs = {}
    sorted.each_cons(2) do |older, newer|
      changes = []
      changes << "query_params" if older.query_params != newer.query_params
      changes << "search_endpoint" if older.search_endpoint_id != newer.search_endpoint_id
      changes << "field_spec" if older.field_spec != newer.field_spec
      changes << "escape_query" if older.escape_query != newer.escape_query
      changes << "number_of_rows" if older.number_of_rows != newer.number_of_rows
      diffs[newer.try_number] = changes if changes.any?
    end
    diffs
  end
end
