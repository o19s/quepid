# frozen_string_literal: true

module Api
  module V1
    # The case's embedder, set the way CaseScorersController sets its scorer: PUT an id,
    # or 0 to remove it. Unlike a scorer, an embedder spends its owner's API key, so it
    # can only be set to one the current user can see, and only on a case they are
    # involved with -- set_case also lets through public cases anyone can view.
    # @tags cases > embedders
    class CaseEmbeddersController < Api::ApiController
      before_action :set_case
      before_action :require_case_involvement, only: [ :update ]

      # The embedders the user could pick, plus the case's current one (which may be
      # one they can't see, if a teammate set it).
      def index
        @current = @case.embedder
        @embedders = current_user.embedders_involved_with.not_archived.order(:name)
      end

      def update
        embedder = nil
        unless embedder_removed?
          embedder = current_user.embedders_involved_with.not_archived.find_by(id: params[:id])
          if embedder.nil?
            render json: { error: 'Embedder not found' }, status: :not_found
            return
          end
        end

        if @case.update(embedder: embedder)
          Analytics::Tracker.track_case_updated_event current_user, @case
          @current = @case.embedder
          @embedders = current_user.embedders_involved_with.not_archived.order(:name)
          render :index
        else
          render json: @case.errors, status: :bad_request
        end
      end

      private

      def embedder_removed?
        [ 0, '0' ].include?(params[:id])
      end

      def require_case_involvement
        return if current_user.cases_involved_with.exists?(id: @case.id)

        render json: { error: 'Case not found' }, status: :not_found
      end
    end
  end
end
