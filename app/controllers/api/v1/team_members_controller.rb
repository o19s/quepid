# frozen_string_literal: true

module Api
  module V1
    # @tags teams > members
    class TeamMembersController < Api::ApiController
      before_action :set_team, only: [ :index, :create, :destroy, :invite ]

      def index
        @members = @team.members
        respond_with @members
      end

      # @summary Add user to team
      # @parameter id(query) [!Integer] The id of the user to be added to the team.
      def create
        @member = User.where('LOWER(users.email) = ? OR users.id = ?',
                             params[:id].to_s.strip.downcase, params[:id].to_i).first

        unless @member
          render json: { error: 'User Not Found!' }, status: :not_found
          return
        end

        if TeamMembership.new(current_user, @team).add_and_save(@member)
          respond_with @member
        else
          render json: @member.errors, status: :bad_request
        end
      end

      # @summary Invite user
      # > Invite someone to join a team.  Creates a shell user account and adds them to the team.
      # @request_body Id is the email address
      #   [
      #     !Hash{
      #       id: !String
      #     }
      #   ]
      # @request_body_example invite
      #   [JSON{
      #     "id": "john@doe.com"
      #   }]

      def invite
        unless signup_enabled?
          render json: { error: 'Signups are disabled!' }, status: :not_found
          return
        end

        membership = TeamMembership.new(current_user, @team)
        @member = membership.invite(params[:id])

        if membership.add_and_save(@member)
          @message = membership.invitation_message(@member)
          respond_with @member
        else
          render json: @member.errors, status: :bad_request
        end
      end

      # @summary Remove user from team
      # @parameter id(query) [!Integer] The id of the user to be removed from the team.
      def destroy
        members = @team.members.where('LOWER(users.email) = ? OR users.id = ?',
                                      params[:id].to_s.strip.downcase, params[:id].to_i)

        membership = TeamMembership.new(current_user, @team)
        members.each { |member| membership.remove(member, track: false) }

        head :no_content
      end
    end
  end
end
