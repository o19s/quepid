# frozen_string_literal: true

# Renders the "Export case" trigger and modal for the case/try workspace.
# Replaces the Angular export_case directive. Export options use existing API
# GET endpoints (ratings, cases, information_needs); modal opens and submit
# is handled by the export_case Stimulus controller.
#
# @see docs/view_component_conventions.md
class ExportCaseComponent < ApplicationComponent
  # @param case_id [Integer] Case id for API URLs
  # @param case_name [String] Display name in modal title and download filenames
  # @param icon_only [Boolean] If true, render only the icon link; otherwise icon + "Export" text
  # @param supports_detailed_export [Boolean] If true, "Detailed" export option is enabled (case view only)
  def initialize case_id:, case_name:, icon_only: true, supports_detailed_export: true
    @case_id                    = case_id
    @case_name                  = case_name
    @icon_only                  = icon_only
    @supports_detailed_export   = supports_detailed_export
  end
end
