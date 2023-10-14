# frozen_string_literal: true

module Api
  module V1
    class TeamsController < Api::ApiController
      before_action :set_team,          only: [ :show, :update, :destroy ]
      before_action :check_team,        only: [ :show, :update, :destroy ]
      before_action :check_team_owner,  only: [ :update, :destroy ]

      # We have a custom :case_load that checks the parameter "for_sharing".
      # If for_sharing is true, then we just need the minimal data to power the
      # sharing dialogue boxes.   If it isn't for sharing something with a team, then we want the much
      # deeper data set
      before_action :case_load,         only: [ :index, :show ]

      def index
        # @teams = current_user.teams_im_in
        # @teams = @teams.preload(:scorers, :members, :cases, :owner).all
        # There may be some more fields we could include...
        # @teams = current_user.teams.includes( :owner, :members, :cases, scorers: [ :teams ] ).all
        @teams = current_user.teams.includes( :cases ).all

        respond_with @teams
      end

      def show
        respond_with @team
      end

      def create
        @team = current_user.owned_teams.build team_params
        @team.members << current_user

        if @team.save
          Analytics::Tracker.track_team_created_event current_user, @team
          respond_with @team
        else
          render json: @team.errors, status: :bad_request
        end
      end

      def update
        if @team.update team_params
          Analytics::Tracker.track_team_updated_event current_user, @team
          respond_with @team
        else
          render json: @team.errors, status: :bad_request
        end
      rescue ActiveRecord::InvalidForeignKey
        render json: { error: 'Invalid id' }, status: :bad_request
      end

      def destroy
        @team.destroy
        Analytics::Tracker.track_team_deleted_event current_user, @team

        head :no_content
      end

      private

      def team_params
        params.require(:team).permit(:name)
      end

      def case_load
        bool = ActiveRecord::Type::Boolean.new
        @for_sharing = bool.deserialize params[:for_sharing]
      end
    end
  end
end
