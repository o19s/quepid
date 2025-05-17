# frozen_string_literal: true

module Api
  module V1
    class TeamCasesController < Api::ApiController
      before_action :set_team,    only: [ :index, :create, :destroy ]
      before_action :check_team,  only: [ :index, :create, :destroy ]

      # @tags teams > cases
      def index
        @cases = @team.cases
        respond_with @cases
      end

      # @summary Share case with a team
      # @tags teams > cases
      # @parameter id(query) [!Integer] The id of the case to be shared with the team.
      def create
        @case = Case.includes( tries: [ :curator_variables ] ).where(id: params[:id]).first

        unless @case
          render json: { error: 'Not Found!' }, status: :not_found
          return
        end

        @team.cases << @case unless @team.cases.exists?(@case.id)
        # if you share a case with a team, you also share it's search endpoint
        search_endpoint = @case.tries.first&.search_endpoint
        @team.search_endpoints << search_endpoint if search_endpoint && !@team.search_endpoints.exists?(search_endpoint.id)

        if @team.save
          Analytics::Tracker.track_case_shared_event current_user, @case, @team
          @shallow = true
          respond_with @case
        else
          render json: @case.errors, status: :bad_request
        end
      end

      # @summary Remove case from team
      # @tags teams > cases
      # @parameter id(query) [!Integer] The id of the case to be removed from the team.
      def destroy
        acase = @team.cases.where(id: params[:id]).all
        @team.cases.delete(acase) if acase

        head :no_content
      end
    end
  end
end
