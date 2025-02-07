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
  end
end
