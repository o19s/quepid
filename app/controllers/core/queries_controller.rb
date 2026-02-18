# frozen_string_literal: true

# Handles query create/destroy for the core workspace with Turbo Stream responses.
# Enables in-place updates (append new row, remove deleted row) without full page reload.
#
# @see docs/turbo_frame_boundaries.md
module Core
  class QueriesController < ApplicationController
    include Authentication::CurrentUserManager
    include Authentication::CurrentCaseManager
    include Authentication::CurrentQueryManager

    before_action :set_case_from_id
    before_action :set_try
    before_action :check_case
    before_action :set_query, only: [ :destroy ]
    before_action :check_query, only: [ :destroy ]

    respond_to :html, :turbo_stream

    # POST /case/:id/queries
    # Creates a query and returns Turbo Stream to append the new row to the query list.
    # Falls back to redirect when Turbo Stream not requested.
    def create
      q_params = query_params
      q_params[:query_text] = q_params[:query_text].to_s.strip if q_params[:query_text]

      existing = @case.queries.find_by(query_text: q_params[:query_text])
      if existing
        @query = existing
        created = false
      else
        @query = @case.queries.build(q_params)
        unless @query.save
          error_message = @query.errors.full_messages.to_sentence
          respond_to do |format|
            format.turbo_stream do
              render turbo_stream: turbo_stream.append(
                "flash",
                partial: "shared/flash_alert",
                locals: { message: error_message }
              ), status: :unprocessable_entity
            end
            format.json { render json: { error: error_message }, status: :unprocessable_entity }
            format.html { redirect_to case_core_path(@case, @try), alert: error_message }
          end
          return
        end
        @query.insert_at(params[:position].to_i) if params[:position].present?
        @case.save
        Analytics::Tracker.track_query_created_event current_user, @query
        created = true
      end

      respond_to do |format|
        format.turbo_stream do
          if created
            streams = [turbo_stream.append("query_list_items", partial: "core/queries/query_row", locals: query_row_locals)]
            streams.unshift(turbo_stream.remove("query_list_empty_placeholder")) if @case.queries.count == 1
            render turbo_stream: streams, status: :created
          else
            render turbo_stream: [], status: :ok
          end
        end
        format.html { redirect_to case_core_path(@case, @try) }
      end
    end

    # DELETE /case/:id/queries/:query_id
    # Destroys a query and returns Turbo Stream to remove the row from the query list.
    # When the deleted query was the currently selected one (selected_query_id param),
    # also returns a Turbo Stream to clear the results pane.
    def destroy
      deleted_id = @query.id
      Analytics::Tracker.track_query_deleted_event current_user, @query
      @query.remove_from_list
      @query.destroy
      @case.rearrange_queries
      @case.save

      respond_to do |format|
        format.turbo_stream do
          streams = [turbo_stream.remove("query_row_#{deleted_id}")]
          if params[:selected_query_id].to_i == deleted_id
            streams << turbo_stream.replace(
              "results_pane",
              render_to_string(
                ResultsPaneComponent.new(
                  case_id: @case.id,
                  try_number: @try&.try_number,
                  selected_query: nil
                )
              )
            )
          end
          if @case.queries.reload.count.zero?
            streams << turbo_stream.append("query_list_items", partial: "core/queries/empty_placeholder")
          end
          render turbo_stream: streams, status: :ok
        end
        format.html { redirect_to case_core_path(@case, @try) }
      end
    end

    private

    def set_case_from_id
      params[:case_id] = params[:id]
      set_case
    end

    def set_try
      @try = if params[:try_number].present?
               @case.tries.where(try_number: params[:try_number]).first
             else
               @case.tries.latest
             end
    end

    def set_query
      @query = @case.queries.find_by(id: params[:query_id])
    end

    def check_query
      render status: :not_found, plain: "Query not found" unless @query
    end

    def query_params
      params.require(:query).permit(:query_text, :information_need, :notes, options: {})
    end

    def query_row_locals
      last_score = @case.last_score
      query_scores = last_score.respond_to?(:queries) && last_score.queries.is_a?(Hash) ? last_score.queries : {}
      other_cases = current_user.cases_involved_with.where.not(id: @case.id).pluck(:id, :case_name).map { |id, name| { id: id, case_name: name } }

      {
        query: @query,
        case_id: @case.id,
        try_number: @try&.try_number,
        selected: false,
        sortable: Rails.application.config.query_list_sortable,
        scorer_scale_max: @case.scorer&.scale&.last || 100,
        query_score: query_scores[@query.id.to_s] || query_scores[@query.id] || "?",
        options_json: @query.options,
        other_cases: other_cases
      }
    end
  end
end
