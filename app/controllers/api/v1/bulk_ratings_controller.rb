# frozen_string_literal: true

module Api
  module V1
    class BulkRatingsController < Api::ApiController
      before_action :find_case
      before_action :check_case
      before_action :set_case_query
      before_action :check_query

      # we pass in a list of doc_ids and a rating hash with the user_id and rating to use
      def update
        if params[:doc_ids].present?
          params[:doc_ids].each do |doc_id|
            # user_id sometimes is nil and sometimes is populated
            rating = @query.ratings.find_or_create_by doc_id: doc_id, user_id: rating_params[:user_id]
            rating.update rating_params
          end
        end

        Analytics::Tracker.track_rating_bulk_updated_event current_user, @query
        head :no_content
      end

      def destroy
        if params[:doc_ids].present?
          params[:doc_ids].each do |doc_id|
            rating = @query.ratings.where(doc_id: doc_id).first
            rating.delete if rating.present?
          end
        end

        Analytics::Tracker.track_rating_bulk_deleted_event current_user, @query
        head :no_content
      end

      private

      def rating_params
        params.require(:rating).permit(:rating, :user_id)
      end
    end
  end
end
