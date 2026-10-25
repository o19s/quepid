# frozen_string_literal: true

module Api
  module V1
    class TeamScorersController < Api::ApiController
      before_action :set_team,    only: [ :index, :create, :destroy ]

      def index
        @scorers = @team.scorers
        respond_with @scorers
      end

      def create
        @scorer = current_user.scorers_involved_with.where(id: params[:id]).first

        unless @scorer
          render json: { error: 'Not Found!' }, status: :not_found
          return
        end

        TeamSharing.new(current_user, @team).share(@scorer)

        if @team.save
          respond_with @scorer
        else
          render json: @scorer.errors, status: :bad_request
        end
      end

      def destroy
        scorer = @team.scorers.find_by(id: params[:id])
        TeamSharing.new(current_user, @team).unshare(scorer) if scorer

        head :no_content
      end
    end
  end
end
