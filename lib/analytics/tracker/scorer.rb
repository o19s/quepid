# frozen_string_literal: true

module Analytics
  module Tracker
    module Scorer
      def track_scorer_created_event user, scorer
        Analytics::GoogleAnalytics.user_created_scorer user, scorer
      end

      def track_scorer_updated_event user, scorer
        Analytics::GoogleAnalytics.user_updated_scorer user, scorer
      end

      def track_scorer_deleted_event user, scorer
        Analytics::GoogleAnalytics.user_deleted_scorer user, scorer
      end

      def track_scorer_shared_event user, scorer, team
        Analytics::GoogleAnalytics.user_shared_scorer user, scorer, team
      end
    end
  end
end
