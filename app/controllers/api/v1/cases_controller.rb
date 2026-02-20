# frozen_string_literal: true

module Api
  module V1
    # @tags cases
    class CasesController < Api::ApiController
      before_action :set_case, only: [ :show, :update, :destroy, :run_evaluation ]
      before_action :check_case, only: [ :show, :update, :destroy, :run_evaluation ]

      # Special handling for cases that are "public"
      def authenticate_api!
        if [ :show, :update, :destroy ].include?(action_name.to_sym)
          set_case
          return true if @case&.public?
        end

        super
      end

      # @parameter archived(query) [Boolean] Whether or not to return only archived cases in the response.
      def index
        archived = deserialize_bool_param(params[:archived])
        @cases = if archived
                   fetch_archived_cases
                 else
                   fetch_active_cases
                 end

        respond_with @cases
      end

      def show
        respond_with @case
      end

      # @request_body Case to be created
      #   [
      #     !Hash{
      #       case: Hash{
      #         case_name: String,
      #         scorer_id: !Integer,
      #         book_id: Integer,
      #         archived: Boolean,
      #         nightly: Boolean
      #       }
      #     }
      #   ]
      # @request_body_example minimal case [JSON{"case": {"case_name": "Movies", "scorer_id": 1}}]
      # @request_body_example complete case
      #   [JSON{
      #       "case": {
      #         "case_name": "Movies",
      #         "scorer_id": 1,
      #         "book_id": 1,
      #         "archived": false,
      #         "nightly": true
      #       }
      #     }
      #   ]
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

      # @request_body Case to be created
      #   [
      #     !Hash{
      #       case: Hash{
      #         case_name: String,
      #         scorer_id: !Integer,
      #         book_id: Integer,
      #         archived: Boolean,
      #         nightly: Boolean
      #       }
      #     }
      #   ]
      # @request_body_example minimal case [JSON{"case": {"case_name": "Movies Are Cool", "scorer_id": 2}}]
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

      def destroy
        @case.really_destroy
        Analytics::Tracker.track_case_deleted_event current_user, @case

        head :no_content
      end

      # @summary Run Case Evaluation
      #
      # This endpoint triggers a background job that executes all queries in the case against
      # the search endpoint, collects the results, and calculates scores. Progress updates
      # are broadcast to the front end.
      #
      # @parameter try_number(query) [Integer] The try number to use for running queries.
      #   If not specified, defaults to the case's last_try_number.
      #
      # @response 200 [Hash{message: String, case_id: Integer, try_number: Integer}]
      # @response_example 200 [JSON{"message": "Job queued to evaluate queries", "case_id": 1, "try_number": 2}]
      # @response Case not found or user does not have access Id(404) []
      # @response Try not found for the specified try_number Id(422) []
      def run_evaluation
        try_number = if params[:try_number].present?
                       params[:try_number].to_i
                     else
                       @case.last_try_number
                     end

        @try = @case.tries.find_by(try_number: try_number)

        if @try.nil?
          render json: { error: "Try with try_number #{try_number} not found" }, status: :unprocessable_content
          return
        end

        RunCaseEvaluationJob.perform_later @case, @try, user: current_user

        render json: {
          message:    'Job queued to evaluate queries',
          case_id:    @case.id,
          try_number: @try.try_number,
        }, status: :ok
      end

      private

      def case_params
        params.expect(case: [ :case_name, :scorer_id, :archived, :book_id, :last_try_number, :nightly ])
      end

      def default_scorer_removed? params = {}
        # params[:scorer_id].present? or params.key?(:scorer_id) && [ 0, '0', '' ].include?(params[:scorer_id])
        params[:scorer_id].present? && [ 0, '0' ].include?(params[:scorer_id])
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

        base_query.includes(:owner, :book).preload(:tries, :teams)
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
  end
end
