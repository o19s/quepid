# frozen_string_literal: true

module Authentication
  module CurrentTeamManager
    extend ActiveSupport::Concern

    private

    def set_team
      @team = current_user.teams.where(id: params[:team_id]).first
    end

    def check_team
      render json: { message: 'Team not found!' }, status: :not_found unless @team
    end

    #    def check_team_owner
    #      render json: { error: 'Must be owned to edit team!' }, status: :forbidden unless @team.owner == current_user
    #    end
  end
end
