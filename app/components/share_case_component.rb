# frozen_string_literal: true

# Renders the "Share case" trigger that opens the shared share-case modal.
# Works with the existing share_case Stimulus controller and shared/_share_case_modal.
# Replaces the Angular shareCase component in the workspace.
#
# @see docs/view_component_conventions.md
class ShareCaseComponent < ApplicationComponent
  # @param case_id [Integer] Case id
  # @param case_name [String] Display name for modal title
  # @param all_teams [Array<Hash>, ActiveRecord::Relation] User's teams (id, name) for share dropdown
  # @param shared_teams [Array<Hash>, ActiveRecord::Relation] Teams the case is already shared with (id, name)
  # @param icon_only [Boolean] If true, render only the icon; otherwise icon + "Share case" text
  def initialize(case_id:, case_name:, all_teams:, shared_teams:, icon_only: true)
    @case_id      = case_id
    @case_name    = case_name
    @all_teams    = all_teams.respond_to?(:to_json) ? all_teams : all_teams.to_a
    @shared_teams = shared_teams.respond_to?(:to_json) ? shared_teams : shared_teams.to_a
    @icon_only    = icon_only
  end

  def all_teams_json
    team_json(@all_teams)
  end

  def shared_teams_json
    team_json(@shared_teams)
  end

  private

  def team_json(teams)
    return teams if teams.is_a?(String)
    arr = teams.respond_to?(:to_ary) ? teams.to_ary : teams.to_a
    arr.map { |t| t.respond_to?(:id) ? { id: t.id, name: t.name } : t }.to_json
  end
end
