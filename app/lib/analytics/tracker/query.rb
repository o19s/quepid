# frozen_string_literal: true

module Analytics
  module Tracker
    module Query
      def track_query_created_event _user, query
        track 'Queries', 'Created a Query', label: query.query_text, value: query.case.queries.count
      end

      def track_query_deleted_event _user, query
        track 'Queries', 'Deleted a Query', label: query.query_text
      end

      def track_query_moved_event _user, query, _acase
        track 'Queries', 'Moved a Query', label: query.query_text
      end

      def track_query_notes_updated_event _user, query
        track 'Queries', 'Updated Query Notes', label: query.query_text
      end

      def track_query_options_updated_event _user, query
        track 'Queries', 'Updated Query Options', label: query.query_text
      end
    end
  end
end
