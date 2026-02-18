# frozen_string_literal: true

# Handles query notes form submission via Turbo Frame (no full-page reload).
# Updates notes and information_need, then re-renders the form partial.
#
# @see docs/turbo_frame_boundaries.md
# @see docs/angular_to_stimulus_hotwire_viewcomponents_checklist.md Phase 3
module Core
  module Queries
    class NotesController < ApplicationController
      include Authentication::CurrentUserManager
      include Authentication::CurrentCaseManager
      include Authentication::CurrentQueryManager

      before_action :set_case_from_id
      before_action :set_try
      before_action :check_case
      before_action :set_query
      before_action :check_query

      # PUT /case/:id/queries/:query_id/notes
      # Updates query notes and information_need. Returns Turbo Frame HTML to replace
      # the query notes form region without full-page reload.
      def update
        if @query.update(query_params)
          Analytics::Tracker.track_query_notes_updated_event current_user, @query
          flash.now[:notice] = "Notes saved."
          status = :ok
        else
          flash.now[:alert] = @query.errors.full_messages.to_sentence
          status = :unprocessable_entity
        end

        render partial: "core/queries/notes_form",
               locals: { query: @query, case_id: @case.id },
               layout: false,
               status: status
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
        params.require(:query).permit(:notes, :information_need)
      end
    end
  end
end
