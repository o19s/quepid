# frozen_string_literal: true

# Renders an "Expand" trigger and a full-screen modal that shows a title and content.
# Replaces the Angular expand_content directive. Used by MatchesComponent for the
# document explain expand view; can be reused anywhere a full-screen content modal
# is needed.
#
# @see docs/view_component_conventions.md
class ExpandContentComponent < ApplicationComponent
  # @param id [String] Unique id for the modal (required when multiple expand modals exist on the page)
  # @param title [String] Modal heading
  # @param body [String] Modal body content (escaped in the template; named body to avoid ViewComponent#content)
  # @param trigger_label [String] Label for the expand button (default: "Expand")
  def initialize id:, title:, body:, trigger_label: 'Expand'
    @id            = id
    @title         = title
    @body          = body
    @trigger_label = trigger_label
  end
end
