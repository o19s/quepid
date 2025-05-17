# frozen_string_literal: true

module Api
  module V1
    class TeamMembersController < Api::ApiController
      before_action :set_team,          only: [ :index, :create, :destroy, :invite ]
      before_action :check_team,        only: [ :index, :create, :destroy, :invite ]

      # @tags teams > members
      def index
        @members = @team.members
        respond_with @members
      end

      # @summary Add user to team
      # @tags teams > members
      # @parameter id(query) [!Integer] The id of the user to be added to the team.
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

      # @tags teams > members
      # @summary Invite user
      # > Invite someone to join a team.  Creates a shell user account and adds them to the team.
      # @request_body Id is the email address
      #   [
      #     !Hash{
      #       id: !String
      #     }
      #   ]
      # @request_body_example invite [Hash]
      #   {
      #     id: "john@doe.com"
      #   }

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

      # @summary Remove user from team
      # @tags teams > members
      # @parameter id(query) [!Integer] The id of the user to be removed from the team.
      def destroy
        member = @team.members.where('email = ? OR id = ?', params[:id].to_s.downcase, params[:id])

        @team.members.delete(member) if member

        head :no_content
      end
    end
  end
end
