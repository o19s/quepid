# frozen_string_literal: true

# Renders the results pane for the case/try workspace. When a query is selected,
# fetches search results and displays document cards with inline rating (popover).
# When no query is selected, prompts the user to select one.
#
# Features:
# - Inline rating: click the rating badge on a document card to set/clear rating via popover
# - Pagination: Load more button fetches additional results (API rows/start params)
# - Debug/Expand: when search engine returns explain data (e.g. Solr), each card shows
#   Debug (raw JSON modal) and Expand (full-screen modal) buttons
# - Diff mode indicator: when snapshots are selected for comparison (DiffComponent),
#   shows a "Diff mode" badge
# - Diff display: when diff mode is on, document cards show position deltas vs. selected
#   snapshot(s) (e.g. "was #5 in Snapshot X", "new in current")
#
# Uses a slot for flexible composition: pass custom results content via
# +with_results_content+ (e.g. MatchesComponent, document list). When no slot
# is provided, fetches and renders document cards.
#
# When +results_content+ is provided, the Stimulus controller skips fetching
# (data-results-pane-skip-fetch-value="true") so the slot content is preserved.
#
# @see docs/view_component_conventions.md
# @see docs/legacy_assets_remaining.md
class ResultsPaneComponent < ApplicationComponent
  renders_one :results_content
  # @param case_id [Integer] Current case id
  # @param try_number [Integer, nil] Current try number
  # @param selected_query [Query, Hash, nil] Currently selected query (id, query_text); nil if none
  # @param scorer_scale [Array<Integer>, nil] Rating scale from case scorer (e.g. [0,1,2,3]); passed to DocFinder
  # @param scale_with_labels [Hash, nil] Optional label map from scorer: { "0" => "Not Relevant", "3" => "Perfect" }
  def initialize case_id:, try_number:, selected_query: nil, scorer_scale: nil, scale_with_labels: nil
    @case_id             = case_id
    @try_number          = try_number
    @selected_query      = selected_query
    @scorer_scale        = scorer_scale.presence || [ 0, 1, 2, 3 ]
    @scale_with_labels   = scale_with_labels || {}
  end

  def selected?
    @selected_query.present?
  end

  def query_text
    return nil unless @selected_query

    @selected_query.respond_to?(:query_text) ? @selected_query.query_text : @selected_query[:query_text]
  end

  def query_id
    return nil unless @selected_query

    @selected_query.respond_to?(:id) ? @selected_query.id : @selected_query[:id]
  end

  def notes_text
    return '' unless @selected_query

    @selected_query.respond_to?(:notes) ? @selected_query.notes.to_s : ''
  end

  def notes_information_need
    return '' unless @selected_query

    @selected_query.respond_to?(:information_need) ? @selected_query.information_need.to_s : ''
  end
end
