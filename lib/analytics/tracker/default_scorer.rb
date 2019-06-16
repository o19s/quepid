# frozen_string_literal: true

module Analytics
  module Tracker
    module DefaultScorer
      def track_default_scorer_created_event user, scorer
        Analytics::GA.user_created_default_scorer user, scorer
      end

      def track_default_scorer_updated_event user, scorer
        Analytics::GA.user_updated_default_scorer user, scorer
      end
    end
  end
end
