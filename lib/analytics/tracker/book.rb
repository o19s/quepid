# frozen_string_literal: true

module Analytics
  module Tracker
    module Book
      def track_query_doc_pairs_bulk_updated_event user, book, empty = false
        if empty
          Analytics::GoogleAnalytics.user_populated_book user, book
        else
          Analytics::GoogleAnalytics.user_refreshed_book user, book
        end
      end
    end
  end
end
