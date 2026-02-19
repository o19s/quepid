# frozen_string_literal: true

# Renders a collapsible query params panel placeholder. Replaces QueryParamsCtrl,
# QueryParamsDetailsCtrl, queryParamsHistoryCtrl. Full implementation (query
# sandbox, tuning knobs, history) deferred; this provides the toggle and basic
# try info.
#
# @see docs/legacy_assets_remaining.md
# @see docs/view_component_conventions.md
class QueryParamsPanelComponent < ApplicationComponent
  # @param try [Try, nil] Current try
  # @param case_id [Integer] Case id for API links
  def initialize try: nil, case_id: nil
    @try     = try
    @case_id = case_id
  end

  def query_params_preview
    return '—' if @try.blank? || @try.query_params.blank?

    str = @try.query_params.to_s
    str.length > 100 ? "#{str[0..100]}…" : str
  end
end
