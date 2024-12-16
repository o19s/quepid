# frozen_string_literal: true

module Analytics
  module Tracker
    module Case
      def track_case_created_event user, acase, first = false
        if first
          Analytics::Ahoy.user_created_first_case user, acase
        else
          Analytics::Ahoy.user_created_case user, acase
        end
      end

      def track_case_updated_event user, acase
        Analytics::Ahoy.user_updated_case user, acase
      end

      def track_case_archived_event user, acase
        Analytics::Ahoy.user_archived_case user, acase
      end

      def track_case_deleted_event user, acase
        Analytics::Ahoy.user_deleted_case user, acase
      end

      def track_case_shared_event user, acase, team
        Analytics::Ahoy.user_shared_case user, acase, team
      end

      def track_user_swapped_protocol user, acase, protocol
        Analytics::Ahoy.user_swapped_protocol user, acase, protocol
      end
    end
  end
end
