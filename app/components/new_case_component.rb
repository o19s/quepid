# frozen_string_literal: true

# Renders the "Create a case" entry point that starts the new-case flow.
# Links to GET case_new_path (CoreController#new), which creates a case and redirects
# to the case workspace with showWizard=true. The multi-step wizard modal (when
# showWizard=true) is a separate follow-up migration.
#
# Replaces the Angular newCase directive (button that called caseSvc.createCase()
# then opened the wizard modal).
#
# @see docs/view_component_conventions.md
class NewCaseComponent < ApplicationComponent
  # @param button_text [String] Label for the link/button (e.g. "Create a case")
  # @param button_class [String] CSS classes for the link (default: btn btn-success)
  # @param block_style [Boolean] If true, render as full-width block (e.g. in dropdown)
  def initialize(button_text: "Create a case", button_class: "btn btn-success", block_style: false)
    @button_text  = button_text
    @button_class = button_class
    @block_style  = block_style
  end
end
