# frozen_string_literal: true

module Api
  module V1
    class BulkRatingsController < Api::ApiController
      before_action :set_case
      before_action :check_case
      before_action :set_case_query
      before_action :check_query

      # We get a messy set of params in this method, so we don't use the normal
      # approach of strong parameter validation.  We hardcode the only params
      # we care about.
      def update
        if params[:doc_ids].present?
          params[:doc_ids].each do |doc_id|
            rating = @query.ratings.find_or_create_by doc_id: doc_id

            # rating.update rating_params
            rating.rating = pluck_out_just_rating_param
            rating.save
            JudgementFromRatingJob.perform_later current_user, rating
          end
        end

        Analytics::Tracker.track_rating_bulk_updated_event current_user, @query
        head :no_content
      end

      def destroy
        if params[:doc_ids].present?
          params[:doc_ids].each do |doc_id|
            rating = @query.ratings.where(doc_id: doc_id).first
            rating.presence&.delete
          end
        end

        Analytics::Tracker.track_rating_bulk_deleted_event current_user, @query
        head :no_content
      end

      private

      def pluck_out_just_rating_param
        # Bulk ratings API accepts a top-level scalar `rating`:
        # { doc_ids: ["id1", "id2"], rating: 5 }
        params.permit(:rating)[:rating]
      end
    end
  end
end
