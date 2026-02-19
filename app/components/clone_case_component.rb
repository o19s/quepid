# frozen_string_literal: true

# Renders the "Clone case" trigger and modal for the case/try workspace.
# Replaces the Angular clone_case component. Submit is handled by the clone_case
# Stimulus controller, which POSTs to api/clone/cases and redirects to the new case.
#
# @see docs/view_component_conventions.md
class CloneCaseComponent < ApplicationComponent
  # @param case_id [Integer] Case id for API and redirect
  # @param case_name [String] Display name in modal title
  # @param tries [Array<Hash>] List of { try_number:, name: } for the try dropdown
  # @param last_try_number [Integer] Default selected try when "only a specific try" is chosen
  def initialize case_id:, case_name:, tries:, last_try_number: nil
    @case_id          = case_id
    @case_name        = case_name
    @tries            = tries
    @last_try_number  = last_try_number || tries&.dig(0, :try_number)
  end

  def tries_json
    (@tries || []).to_json
  end
end
