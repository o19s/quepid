# frozen_string_literal: true

module Api
  module V1
    # rubocop:disable Metrics/ClassLength
    class CasesController < Api::ApiController
      before_action :set_case, only: [ :show, :update, :destroy ]
      before_action :check_case, only: [ :show, :update, :destroy ]

      def_param_group :case_params do
        param :case, Hash, required: true do
          param :case_name, String
          param :scorer_id, Integer
          param :book_id, Integer
          param :last_try_number, Integer
          param :archived, [ true, false ]
        end
      end

      # Spiking out can we make an API public?
      def authenticate_api!
        set_case
        return true if @case&.public? || current_user

        render json:   { reason: 'Unauthorized!' },
               status: :unauthorized
      end

      api :GET, '/api/cases',
          'List all cases to which the user has access.'
      error :code => 401, :desc => 'Unauthorized'
      param :archived, [ true, false ],
            :desc          => 'Whether or not to include archived cases in the response.',
            :required      => false,
            :default_value => false
      param :deep, [ true, false ],
            :desc          => '', # TODO: Unsure of what deep adds, it isn't used in the body below.
            :required      => false,
            :default_value => false
      def index
        archived = deserialize_bool_param(params[:archived])
        @cases = if archived
                   fetch_archived_cases
                 else
                   fetch_active_cases
                 end

        respond_with @cases
      end

      api :GET, '/api/cases/:case_id',
          'Show the case with the given ID.'
      param :case_id, :number,
            desc: 'The ID of the requested case.', required: true
      def show
        respond_with @case
      end

      api :POST, '/api/cases', 'Create a new case.'
      param_group :case_params
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
      api :PUT, '/api/cases/:case_id', 'Update a given case.'
      param :case_id, :number,
            desc: 'The ID of the requested case.', required: true
      param_group :case_params
      def update
        update_params = case_params
        update_params[:scorer_id] = Scorer.system_default_scorer.id if default_scorer_removed? update_params
        archived = deserialize_bool_param(update_params[:archived])
        if archived
          # archiving a case means current user takes it over, that should be better expressed.
          @case.owner = current_user
          @case.mark_archived!
          Analytics::Tracker.track_case_archived_event current_user, @case
          respond_with @case
        elsif @case.update update_params
          if update_params[:book_id]
            @book = Book.find(update_params[:book_id])
            TrackBookViewedJob.perform_now current_user, @book
          end
          Analytics::Tracker.track_case_updated_event current_user, @case
          respond_with @case
        else
          render json: @case.errors, status: :bad_request
        end
      rescue ActiveRecord::InvalidForeignKey
        render json: { error: 'Invalid id' }, status: :bad_request
      end
      # rubocop:enable Metrics/MethodLength

      api :DELETE, '/api/cases/:case_id', 'Delete a given case.'
      param :case_id, :number,
            desc: 'The ID of the requested case.', required: true
      def destroy
        @case.really_destroy
        Analytics::Tracker.track_case_deleted_event current_user, @case

        head :no_content
      end

      private

      def case_params
        params.require(:case).permit(:case_name, :scorer_id, :archived, :book_id, :last_try_number)
      end

      def default_scorer_removed? params = {}
        # params[:scorer_id].present? or params.key?(:scorer_id) && [ 0, '0', '' ].include?(params[:scorer_id])
        params[:scorer_id].present? && [ 0, '0' ].include?(params[:scorer_id])
      end

      def deserialize_bool_param param
        ActiveRecord::Type::Boolean.new.deserialize(param) || false
      end

      def fetch_archived_cases
        @no_tries = true
        @no_teams = false
        Case.where(archived: true, owner_id: current_user.id).all.with_counts
      end

      def fetch_active_cases
        if current_user.cases_involved_with.size > 30
          fetch_limited_cases
        else
          fetch_full_cases
        end
      end

      def fetch_limited_cases
        @no_tries = true
        @no_teams = true
        @no_scores = true

        base_query.includes(:owner, :book)
      end

      def fetch_full_cases
        @no_tries = false
        @no_teams = false
        @no_scores = false

        base_query.includes(:owner, :book).preload(:tries, :teams, :cases_teams)
          .left_outer_joins(:metadata) # this is slow!
          .select('cases.*, case_metadata.last_viewed_at')
          .order(Arel.sql('`case_metadata`.`last_viewed_at` DESC, `cases`.`updated_at` DESC'))
      end

      def base_query
        current_user.cases_involved_with
          .not_archived
          .with_counts
          .order(:updated_at)
      end
    end
    # rubocop:enable Metrics/ClassLength
  end
end
