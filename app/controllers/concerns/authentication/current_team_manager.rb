# frozen_string_literal: true

module Authentication
  module CurrentTeamManager
    extend ActiveSupport::Concern

    private

    def set_team
      @team = current_user.teams.find(params.expect(:team_id))
    end
  end
end
