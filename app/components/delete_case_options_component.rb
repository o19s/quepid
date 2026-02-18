# frozen_string_literal: true

# Renders the "Delete" trigger and options modal (Delete All Queries, Archive Case,
# Delete Case). Replaces the Angular delete_case_options component. Action is
# handled by the delete_case_options Stimulus controller.
#
# @see docs/view_component_conventions.md
class DeleteCaseOptionsComponent < ApplicationComponent
  # @param case_id [Integer] Case id for API
  # @param case_name [String] Display name in modal title
  # @param try_number [Integer, nil] Current try number for redirect after "Delete All Queries" (optional)
  # @param icon_only [Boolean] If true, render only icon; otherwise icon + "Delete" text
  def initialize(case_id:, case_name:, try_number: nil, icon_only: true)
    @case_id     = case_id
    @case_name   = case_name
    @try_number  = try_number
    @icon_only   = icon_only
  end
end
