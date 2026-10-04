# frozen_string_literal: true

module Analytics
  module Tracker
    module Team
      def track_team_created_event _user, team
        track 'Teams', 'Created an Team', label: team.name, value: 1
      end

      def track_team_updated_event _user, team
        track 'Teams', 'Updated an Team', label: team.name
      end

      def track_team_deleted_event _user, team
        track 'Teams', 'Deleted an Team', label: team.name
      end

      def track_member_added_to_team_event _user, team, _member
        track 'Teams', 'Added Member to an Team', label: team.name, value: team.members.count
      end

      def track_member_removed_from_team_event _user, team, _member
        track 'Teams', 'Removed Member from an Team', label: team.name, value: team.members.count
      end
    end
  end
end
