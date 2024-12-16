# frozen_string_literal: true

module Analytics
  module Tracker
    module Rating
      def track_rating_created_event user, rating
        Analytics::Ahoy.user_created_rating user, rating
      end

      def track_rating_deleted_event user, rating
        Analytics::Ahoy.user_deleted_rating user, rating
      end

      def track_rating_bulk_updated_event user, query
        Analytics::Ahoy.user_bulk_updated_ratings user, query
      end

      def track_rating_bulk_deleted_event user, query
        Analytics::Ahoy.user_bulk_deleted_ratings user, query
      end
    end
  end
end
