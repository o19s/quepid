# frozen_string_literal: true

class UnarchiveCaseComponent < ApplicationComponent
  def initialize current_user_teams:
    @current_user_teams = current_user_teams
  end

  def teams_json
    @current_user_teams.map { |t| { id: t.id, name: t.name } }.to_json
  end
end
