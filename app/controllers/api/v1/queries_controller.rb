# frozen_string_literal: true

module Api
  module V1
    class QueriesController < Api::ApiController
      before_action :set_case
      before_action :check_case
      before_action :set_query,   only: [ :update, :destroy ]
      before_action :check_query, only: [ :update, :destroy ]

      def index
        @queries = @case.queries.includes([ :ratings ])

        @display_order = @queries.map(&:id)

        respond_with @queries, @display_order
      end

      # rubocop:disable Metrics/MethodLength
      # rubocop:disable Metrics/AbcSize
      def create
        q_params              = query_params
        q_params[:query_text] = q_params[:query_text].strip if q_params[:query_text]

        query = 'BINARY query_text = ?'
        if @case.queries.exists?([ query, q_params[:query_text] ])
          # sometimes the query is already created even though we are hitting this..
          @query = @case.queries.find_by([ query, q_params[:query_text] ])
          @display_order = @case.queries.map(&:id)
          respond_with @query, @display_order
          return
        end

        @query = @case.queries.build q_params

        if @query.save
          @query.insert_at(params[:position].to_i) if params[:position]
          @case.save

          Analytics::Tracker.track_query_created_event current_user, @query

          @display_order = @case.queries.map(&:id)

          respond_with @query, @display_order
        else
          render json: @query.errors, status: :bad_request
        end
      end
      # rubocop:enable Metrics/MethodLength
      # rubocop:enable Metrics/AbcSize

      def update
        @other_case = Case.where(id: params[:other_case_id]).first

        unless @other_case
          render json: { error: 'Not Found!' }, status: :not_found
          return
        end

        @query.remove_from_list

        @query.case = @other_case
        @query.insert_at 0

        @other_case.save
        @query.save

        # Make sure queries have the right `arranged_next` and `arranged_at`
        # values after the query has been removed
        @case.rearrange_queries
        @case.save

        Analytics::Tracker.track_query_moved_event current_user, @query, @case

        respond_with @query
      end

      def destroy
        @query.remove_from_list
        @query.destroy
        Analytics::Tracker.track_query_deleted_event current_user, @query

        # Make sure queries have the right `arranged_next` and `arranged_at`
        # values after the query has been removed
        @case.rearrange_queries
        @case.save

        head :no_content
      end

      private

      def query_params
        params.expect(query: [ :query_text, :information_need, :notes, { options: {} } ])
      end
    end
  end
end
