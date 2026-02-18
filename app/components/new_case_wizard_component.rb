# frozen_string_literal: true

# Renders the new case wizard modal. Shown when the user creates a case via
# NewCaseComponent and is redirected with showWizard=true. Guides the user
# through a multi-step setup: search endpoint, field spec, first query.
#
# Replaces the Angular WizardModalCtrl with a 4-step guided flow.
#
# @see docs/legacy_assets_remaining.md
# @see docs/view_component_conventions.md
class NewCaseWizardComponent < ApplicationComponent
  # @param show [Boolean] Whether to show the wizard on load (from params[:showWizard])
  # @param case_id [Integer] Current case id
  # @param case_name [String] Case name for display
  # @param try_number [Integer, nil] Current try number
  # @param current_user_id [Integer] Current user id (for completed_case_wizard API)
  # @param settings_path [String, nil] Path to search endpoint settings (optional)
  # @param search_endpoints [ActiveRecord::Relation, Array] User's available search endpoints
  def initialize(show: false, case_id: nil, case_name: "", try_number: nil, current_user_id: nil, settings_path: nil, search_endpoints: [])
    @show              = show
    @case_id           = case_id
    @case_name         = case_name
    @try_number        = try_number
    @current_user_id   = current_user_id
    @settings_path     = settings_path
    @search_endpoints  = search_endpoints
  end

  def search_endpoints_json
    @search_endpoints.map { |ep| { id: ep.id, name: ep.name, search_engine: ep.search_engine, endpoint_url: ep.endpoint_url } }.to_json
  end
end
