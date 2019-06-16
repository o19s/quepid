# frozen_string_literal: true

module Analytics
  module Tracker
    module Team
      def track_team_created_event user, team
        Analytics::GA.user_created_team user, team
      end

      def track_team_updated_event user, team
        Analytics::GA.user_updated_team user, team
      end

      def track_team_deleted_event user, team
        Analytics::GA.user_deleted_team user, team
      end

      def track_member_added_to_team_event user, team, member
        Analytics::GA.user_added_member_to_team user, team, member
      end
    end
  end
end
