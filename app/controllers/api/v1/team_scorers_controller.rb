# frozen_string_literal: true

module Api
  module V1
    class TeamScorersController < Api::ApiController
      before_action :set_team,    only: [ :index, :create, :destroy ]
      before_action :check_team,  only: [ :index, :create, :destroy ]

      def index
        @scorers = @team.scorers
        respond_with @scorers
      end

      def create
        @scorer = Scorer.where(id: params[:id]).first

        unless @scorer
          render json: { error: 'Not Found!' }, status: :not_found
          return
        end

        @team.scorers << @scorer unless @team.scorers.exists?(@scorer.id)

        if @team.save
          Analytics::Tracker.track_scorer_shared_event current_user, @scorer, @team
          respond_with @scorer
        else
          render json: @scorer.errors, status: :bad_request
        end
      end

      def destroy
        scorer = @team.scorers.where(id: params[:id]).all
        @team.scorers.delete(scorer) if scorer

        head :no_content
      end
    end
  end
end
