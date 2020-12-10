# frozen_string_literal: true

module Api
  module V1
    class TeamCasesController < Api::ApiController
      before_action :set_team,    only: [ :index, :create, :destroy ]
      before_action :check_team,  only: [ :index, :create, :destroy ]

      def index
        @cases = @team.cases
        respond_with @cases
      end

      def create
        @case = Case.includes( tries: [ :curator_variables ] ).where(id: params[:id]).first

        unless @case
          render json: { error: 'Not Found!' }, status: :not_found
          return
        end

        @team.cases << @case unless @team.cases.exists?(@case.id)

        if @team.save
          Analytics::Tracker.track_case_shared_event current_user, @case, @team
          respond_with @case
        else
          render json: @case.errors, status: :bad_request
        end
      end

      def destroy
        acase = @team.cases.where(id: params[:id]).all
        @team.cases.delete(acase) if acase

        head :no_content
      end
    end
  end
end
