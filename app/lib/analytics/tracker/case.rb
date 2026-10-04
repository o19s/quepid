# frozen_string_literal: true

module Analytics
  module Tracker
    module Case
      def track_case_created_event user, acase, first = false
        if first
          track 'Cases', 'Created First Case', label: user.email, value: 1
        else
          track 'Cases', 'Created a Case', label: acase.case_name, value: user.cases.count
        end
      end

      def track_case_updated_event _user, acase
        track 'Cases', 'Updated a Case', label: acase.case_name
      end

      def track_case_archived_event _user, acase
        track 'Cases', 'Archived a Case', label: acase.case_name
      end

      def track_case_deleted_event _user, acase
        track 'Cases', 'Deleted a Case', label: acase.case_name
      end

      def track_case_shared_event _user, acase, _team
        track 'Cases', 'Shared a Case', label: acase.case_name
      end

      def track_user_swapped_protocol _user, acase, protocol
        track 'Cases', 'Swapped to Protocol', label: acase.case_name, value: protocol, case_id: acase.id
      end
    end
  end
end
