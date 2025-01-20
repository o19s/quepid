# frozen_string_literal: true

module Analytics
  module Tracker
    module Query
      def track_query_created_event user, query
        Analytics::Ahoy.user_created_query user, query
      end

      def track_query_deleted_event user, query
        Analytics::Ahoy.user_deleted_query user, query
      end

      def track_query_moved_event user, query, acase
        Analytics::Ahoy.user_moved_query user, query, acase
      end

      def track_query_notes_updated_event user, query
        Analytics::Ahoy.user_updated_query_notes user, query
      end

      def track_query_options_updated_event user, query
        Analytics::Ahoy.user_updated_query_options user, query
      end
    end
  end
end
