# frozen_string_literal: true

module Api
  module V1
    class TeamMembersController < Api::ApiController
      api!
      before_action :set_team,          only: [ :index, :create, :destroy, :invite ]
      before_action :check_team,        only: [ :index, :create, :destroy, :invite ]

      def_param_group :invite_user_params do
        param :id, String, desc: 'Oddly enough this is the email address of the person to invite'
      end

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

      # rubocop:disable Layout/LineLength
      api :POST, '/api/teams/:team_id/members/invite', 'Invite someone to join a team.  Creates a shell user account and adds them to the team.'
      param_group :invite_user_params
      def invite
        unless signup_enabled?
          render json: { error: 'Signups are disabled!' }, status: :not_found
          return
        end

        @member = User.invite!({ email: params[:id], password: '' }, current_user) do |u|
          u.skip_invitation = !email_notifications_enabled?
        end

        @team.members << @member unless @team.members.exists?(@member.id)

        if @team.save
          Analytics::Tracker.track_member_added_to_team_event current_user, @team, @member
          @message = @member.skip_invitation.present? ? "Please share the invite link with #{@member.email} directly so they can join." : "Invitation email was sent to #{@member.email}"
          respond_with @member
        else
          render json: @member.errors, status: :bad_request
        end
      end
      # rubocop:enable Layout/LineLength

      def destroy
        member = @team.members.where('email = ? OR id = ?', params[:id].to_s.downcase, params[:id])

        @team.members.delete(member) if member

        head :no_content
      end
    end
  end
end
