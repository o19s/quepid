# frozen_string_literal: true

module Analytics
  module Tracker
    module Case
      def track_case_created_event user, acase, first = false
        if first
          Analytics::GA.user_created_first_case user, acase
        else
          Analytics::GA.user_created_case user, acase
        end
      end

      def track_case_updated_event user, acase
        Analytics::GA.user_updated_case user, acase
      end

      def track_case_archived_event user, acase
        Analytics::GA.user_archived_case user, acase
      end

      def track_case_shared_event user, acase, team
        Analytics::GA.user_shared_case user, acase, team
      end
    end
  end
end
