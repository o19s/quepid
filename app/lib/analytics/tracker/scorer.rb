# frozen_string_literal: true

module Analytics
  module Tracker
    module Scorer
      def track_scorer_created_event user, scorer
        track 'Scorers', 'Created a Scorer', label: scorer.name, value: user.owned_scorers.count
      end

      def track_scorer_updated_event _user, scorer
        track 'Scorers', 'Updated a Scorer', label: scorer.name
      end

      def track_scorer_deleted_event _user, scorer
        track 'Scorers', 'Deleted a Scorer', label: scorer.name
      end

      def track_scorer_shared_event _user, scorer, _team
        track 'Scorers', 'Shared a Scorer', label: scorer.name
      end
    end
  end
end
