# frozen_string_literal: true

# Renders a "Delete query" trigger and confirmation modal for a single query row.
# Replaces the Angular delete-query behavior. Submit is handled by the delete_query
# Stimulus controller, which sends DELETE to case/:id/queries/:query_id (Turbo Stream)
# or api/cases/:id/queries/:query_id (JSON fallback).
#
# When the deleted query is the currently selected one, passes selected_query_id so
# the server can return a Turbo Stream to clear the results pane.
#
# @see docs/view_component_conventions.md
class DeleteQueryComponent < ApplicationComponent
  # @param case_id [Integer] Case id for API
  # @param query_id [Integer] Query id to delete
  # @param query_text [String] Query text for confirmation message (truncated)
  # @param try_number [Integer, nil] Try number for redirect after delete
  # @param selected_query_id [Integer, nil] When present and equal to query_id, server clears results pane
  def initialize(case_id:, query_id:, query_text:, try_number: nil, selected_query_id: nil)
    @case_id           = case_id
    @query_id          = query_id
    @query_text        = query_text.to_s.truncate(50)
    @try_number        = try_number
    @selected_query_id = selected_query_id
  end
end
