# frozen_string_literal: true

module Api
  module V1
    class TeamMembersController < Api::ApiController
      before_action :set_team,          only: %i[index create destroy]
      before_action :check_team,        only: %i[index create destroy]

      def index
        @members = @team.members
        respond_with @members
      end

      def create
        @member = User.where('email = ? OR id = ?', params[:id].to_s.downcase, params[:id] ).first

        unless @member
          render json: { error: 'User Not Found!' }, status: :not_found
          return
        end

        @team.members << @member unless @team.members.exists?(@member.id)

        if @team.save
          Analytics::Tracker.track_member_added_to_team_event current_user, @team, @member
          respond_with @member
        else
          render json: @member.errors, status: :bad_request
        end
      end

      def destroy
        member = @team.members.where('email = ? OR id = ?', params[:id].to_s.downcase, params[:id])

        @team.members.delete(member) if member

        head :no_content
      end
    end
  end
end
