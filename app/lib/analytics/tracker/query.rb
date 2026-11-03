# frozen_string_literal: true

module Analytics
  module Tracker
    module Query
      def track_query_created_event query
        track 'Queries', 'Created a Query', label: query.query_text, value: query.case.queries.count
      end

      def track_query_deleted_event query
        track 'Queries', 'Deleted a Query', label: query.query_text
      end

      def track_query_moved_event query
        track 'Queries', 'Moved a Query', label: query.query_text
      end

      def track_query_notes_updated_event query
        track 'Queries', 'Updated Query Notes', label: query.query_text
      end

      def track_query_options_updated_event query
        track 'Queries', 'Updated Query Options', label: query.query_text
      end
    end
  end
end
