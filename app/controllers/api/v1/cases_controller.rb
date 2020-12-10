# frozen_string_literal: true

module Api
  module V1
    class CasesController < Api::ApiController
      before_action :set_case, only: [ :update, :destroy ]
      before_action :case_with_all_the_bells_whistles, only: [ :show ]
      before_action :check_case, only: [ :show, :update, :destroy ]

      # rubocop:disable Metrics/MethodLength
      def index
        bool = ActiveRecord::Type::Boolean.new

        archived  = bool.deserialize(params[:archived]) || false
        sort_by   = params[:sortBy]
        @deep     = bool.deserialize(params[:deep]) || false

        if archived
          @no_tries = true
          @no_teams = true
          @cases = Case.where(archived: archived, user_id: current_user.id)
            .all
        else
          @cases = current_user.cases_involved_with.includes(:teams, :tries, :cases_teams).not_archived

          if 'last_viewed_at' == sort_by
            @cases = @cases.limit(3).order(Arel.sql('`case_metadata`.`last_viewed_at` DESC, `cases`.`id`'))
          elsif sort_by
            @cases = @cases.order(sort_by)
          end

          @cases = @cases.all
        end

        respond_with @cases
      end
      # rubocop:enable Metrics/MethodLength

      def create
        @case = current_user.cases.build case_params

        if @case.save
          first = 1 == current_user.cases.count
          Analytics::Tracker.track_case_created_event current_user, @case, first
          respond_with @case
        else
          render json: @case.errors, status: :bad_request
        end
      end

      def show
        respond_with @case
      end

      def update
        update_params = case_params

        update_params[:scorer_id] = Scorer.system_default_scorer.id if default_scorer_removed? update_params

        if @case.update update_params
          Analytics::Tracker.track_case_updated_event current_user, @case
          respond_with @case
        else
          render json: @case.errors, status: :bad_request
        end
      rescue ActiveRecord::InvalidForeignKey
        render json: { error: 'Invalid id' }, status: :bad_request
      end

      def destroy
        if current_user.cases.count > 1
          @case.mark_archived!
          Analytics::Tracker.track_case_archived_event current_user, @case

          respond_with @case
        else
          render json: { error: 'Cannot archive last or only case!' }, status: :forbidden
        end
      end

      private

      def case_params
        params.permit(:case_name, :scorer_id, :archived)
      end

      def default_scorer_removed? params = {}
        # params[:scorer_id].present? or params.key?(:scorer_id) && [ 0, '0', '' ].include?(params[:scorer_id])
        params[:scorer_id].present? && [ 0, '0' ].include?(params[:scorer_id])
      end
    end
  end
end
