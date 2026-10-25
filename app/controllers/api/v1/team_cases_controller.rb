# frozen_string_literal: true

module Api
  module V1
    # @tags teams > cases
    class TeamCasesController < Api::ApiController
      before_action :set_team, only: [ :index, :create, :destroy ]

      def index
        @cases = @team.cases.with_counts.preload(:owner, :book, :teams,
                                                 tries: [ :curator_variables, :search_endpoint ])
        LatestCaseScores.preload(@cases)
        @sampled_case_scores = CaseScoreSamples.load(@cases)
        respond_with @cases
      end

      # @summary Share case with a team
      # @parameter id(query) [!Integer] The id of the case to be shared with the team.
      def create
        @case = current_user.cases_involved_with.includes( tries: [ :curator_variables ] ).where(id: params[:id]).first

        unless @case
          render json: { error: 'Not Found!' }, status: :not_found
          return
        end

        TeamSharing.new(current_user, @team).share(@case)

        if @team.save
          @shallow = true
          respond_with @case
        else
          render json: @case.errors, status: :bad_request
        end
      end

      # @summary Remove case from team
      # @parameter id(query) [!Integer] The id of the case to be removed from the team.
      def destroy
        acase = @team.cases.find_by(id: params[:id])
        TeamSharing.new(current_user, @team).unshare(acase) if acase

        head :no_content
      end
    end
  end
end
