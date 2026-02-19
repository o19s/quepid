# frozen_string_literal: true

# Renders the "Delete case" trigger and confirmation modal for the case/try workspace.
# Replaces the Angular delete_case directive. Submit is handled by the delete_case
# Stimulus controller, which DELETE api/cases/:id then redirects to cases list.
#
# @see docs/view_component_conventions.md
class DeleteCaseComponent < ApplicationComponent
  # @param case_id [Integer] Case id for API
  # @param case_name [String] Optional display name in modal (for confirmation text)
  def initialize case_id:, case_name: nil
    @case_id   = case_id
    @case_name = case_name
  end
end
