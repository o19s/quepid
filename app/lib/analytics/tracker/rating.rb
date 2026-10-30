# frozen_string_literal: true

module Analytics
  module Tracker
    module Rating
      def track_rating_created_event _user, rating
        track 'Ratings', 'Rated a Query', label: rating.query.query_text, value: rating.rating
      end

      def track_rating_deleted_event _user, rating
        track 'Ratings', 'Reset a Query Rating', label: rating.query.query_text
      end

      def track_rating_bulk_updated_event _user, query
        track 'Ratings', 'Bulk Updated Query Ratings', label: query.query_text
      end

      def track_rating_bulk_deleted_event _user, query
        track 'Ratings', 'Bulk Deleted Query Ratings', label: query.query_text
      end
    end
  end
end
