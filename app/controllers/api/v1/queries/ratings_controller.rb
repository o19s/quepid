# frozen_string_literal: true

module Api
  module V1
    module Queries
      # Handles rating create/update and destroy. Supports JSON (API) and Turbo Stream
      # (results pane) formats. Turbo Stream updates the rating badge in-place.
      #
      # @see docs/turbo_streams_guide.md
      class RatingsController < Api::V1::Queries::ApplicationController
        skip_before_action :set_default_response_format, only: [ :update, :destroy ]
        before_action :set_doc_id, only: [ :update, :destroy ]
        before_action :set_ratings_response_format, only: [ :update, :destroy ]

        respond_to :json, :turbo_stream

        def update
          @rating = @query.ratings.find_or_create_by doc_id: @doc_id

          if @rating.update rating_params
            Analytics::Tracker.track_rating_created_event current_user, @rating
            JudgementFromRatingJob.perform_later current_user, @rating
            respond_to do |format|
              format.turbo_stream do
                render turbo_stream: turbo_stream.update(
                  rating_badge_id(@doc_id),
                  partial: "api/v1/queries/ratings/rating_badge",
                  locals: { rating: @rating.rating.to_s }
                ), status: :ok
              end
              format.json { respond_with @rating }
            end
          else
            respond_to do |format|
              format.turbo_stream do
                render turbo_stream: turbo_stream.append(
                  "flash",
                  partial: "shared/flash_alert",
                  locals: { message: @rating.errors.full_messages.to_sentence }
                ), status: :unprocessable_entity
              end
              format.json { render json: @rating.errors, status: :bad_request }
            end
          end
        end

        def destroy
          @rating = @query.ratings.where(doc_id: @doc_id).first
          @rating&.delete
          Analytics::Tracker.track_rating_deleted_event current_user, @rating if @rating

          respond_to do |format|
            format.turbo_stream do
              render turbo_stream: turbo_stream.update(
                rating_badge_id(@doc_id),
                partial: "api/v1/queries/ratings/rating_badge",
                locals: { rating: "" }
              ), status: :ok
            end
            format.json { head :no_content }
          end
        end

        private

        def rating_params
          params.expect(rating: [ :rating, :doc_id ])
        end

        def set_doc_id
          @doc_id = rating_params[:doc_id]
        end

        def set_ratings_response_format
          request.format = :turbo_stream if request.headers["Accept"]&.include?("turbo-stream")
          request.format = :json if request.format != :turbo_stream
        end

        # Sanitize doc_id for use in HTML id attribute (no spaces, valid chars).
        def rating_badge_id(doc_id)
          "rating-badge-#{doc_id.to_s.gsub(/\s/, '_')}"
        end
      end
    end
  end
end
