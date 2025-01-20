# frozen_string_literal: true

module Api
  module V1
    module Queries
      class RatingsController < Api::V1::Queries::ApplicationController
        before_action :set_doc_id, only: [ :update, :destroy ]

        def update
          @rating = @query.ratings.find_or_create_by doc_id: @doc_id
          # @rating.user = @current_user

          if @rating.update rating_params
            Analytics::Tracker.track_rating_created_event current_user, @rating
            JudgementFromRatingJob.perform_later current_user, @rating
            respond_with @rating
          else
            render json: @rating.errors, status: :bad_request
          end
        end

        def destroy
          @rating = @query.ratings.where(doc_id: @doc_id).first
          @rating.delete
          Analytics::Tracker.track_rating_deleted_event current_user, @rating

          head :no_content
        end

        private

        def rating_params
          params.expect(rating: [ :rating, :doc_id ])
        end

        def set_doc_id
          @doc_id = rating_params[:doc_id]
        end
      end
    end
  end
end
