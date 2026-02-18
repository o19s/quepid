# frozen_string_literal: true

# Renders the "Find and rate missing documents" (DocFinder) trigger and modal.
# Replaces DocFinderCtrl and TargetedSearchModalCtrl. Allows searching by custom
# query text, displaying documents, and rating them to influence the scorer.
#
# Requires a selected query context (case, try, query). Rendered in the results
# pane when a query is selected.
#
# @see docs/legacy_assets_remaining.md
# @see docs/view_component_conventions.md
class DocFinderComponent < ApplicationComponent
  # @param case_id [Integer] Case id
  # @param try_number [Integer] Try number
  # @param query_id [Integer] Selected query id
  # @param query_text [String] Selected query text (for display)
  # @param scorer_scale [Array<Integer>] Rating scale from case scorer (e.g. [0,1,2,3])
  def initialize(case_id:, try_number:, query_id:, query_text: "", scorer_scale: [ 0, 1, 2, 3 ])
    @case_id       = case_id
    @try_number    = try_number
    @query_id      = query_id
    @query_text    = query_text
    @scorer_scale  = scorer_scale.presence || [ 0, 1, 2, 3 ]
  end

  def scale_json
    @scorer_scale.to_json
  end
end
