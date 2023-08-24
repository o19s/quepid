# frozen_string_literal: true

module Api
  module V1
    class CasesController < Api::ApiController
      before_action :set_case, only: [ :update, :destroy ]
      before_action :case_with_all_the_bells_whistles, only: [ :show ]
      before_action :check_case, only: [ :show, :update, :destroy ]

      # Spiking out can we make an API public?
      def authenticate_api!
        set_case
        return true if @case&.public? || current_user

        render json:   { reason: 'Unauthorized!' },
               status: :unauthorized
      end

      # rubocop:disable Metrics/MethodLength
      # rubocop:disable Metrics/AbcSize
      def index
        bool = ActiveRecord::Type::Boolean.new

        archived  = bool.deserialize(params[:archived]) || false
        sort_by   = params[:sortBy]
        @deep     = bool.deserialize(params[:deep]) || false

        if archived
          @no_tries = true
          @no_teams = false
          @cases = Case.where(archived: archived, owner_id: current_user.id).all
        else
          @cases = if 'last_viewed_at' == sort_by
                     current_user.cases_involved_with.not_archived.includes(:metadata).references(:metadata)
                       .order(Arel.sql('`case_metadata`.`last_viewed_at` DESC, `cases`.`id`')).limit(3)
                   elsif sort_by
                     current_user.cases_involved_with.preload( :tries).not_archived.order(sort_by)
                   else
                     current_user.cases_involved_with.preload(:tries, :teams,
                                                              :cases_teams)
                       .not_archived
                       .left_outer_joins(:metadata)
                       .order(Arel.sql('`case_metadata`.`last_viewed_at` DESC, `cases`.`updated_at` DESC'))
                   end
        end

        respond_with @cases
      end

      def show
        respond_with @case
      end
      # rubocop:enable Metrics/MethodLength
      # rubocop:enable Metrics/AbcSize

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

      # rubocop:disable Metrics/MethodLength
      def update
        update_params = case_params
        update_params[:scorer_id] = Scorer.system_default_scorer.id if default_scorer_removed? update_params
        bool = ActiveRecord::Type::Boolean.new
        archived = bool.deserialize(update_params[:archived]) || false
        if archived
          # archiving a case means current user takes it over, that should be better expressed.
          @case.owner = current_user
          @case.mark_archived!
          Analytics::Tracker.track_case_archived_event current_user, @case
          respond_with @case
        elsif @case.update update_params
          Analytics::Tracker.track_case_updated_event current_user, @case
          respond_with @case
        else
          render json: @case.errors, status: :bad_request
        end
      rescue ActiveRecord::InvalidForeignKey
        render json: { error: 'Invalid id' }, status: :bad_request
      end
      # rubocop:enable Metrics/MethodLength

      def destroy
        @case.really_destroy
        Analytics::Tracker.track_case_deleted_event current_user, @case

        render json: {}, status: :no_content
      end

      private

      def case_params
        params.require(:case).permit(:case_name, :scorer_id, :archived, :book_id)
      end

      def default_scorer_removed? params = {}
        # params[:scorer_id].present? or params.key?(:scorer_id) && [ 0, '0', '' ].include?(params[:scorer_id])
        params[:scorer_id].present? && [ 0, '0' ].include?(params[:scorer_id])
      end
    end
  end
end
