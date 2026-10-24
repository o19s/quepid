# frozen_string_literal: true

module Analytics
  module Tracker
    module User
      def track_signup_event user
        track 'Users', 'Signed Up', label: user.email
      end

      def track_user_updated_profile_event user
        track 'Users', 'Updated Profile', label: user.email
      end

      def track_user_updated_password_event user
        track 'Users', 'Updated Password', label: user.email
      end

      def track_user_updated_by_admin_event user
        track 'Users', 'Updated by Admin', label: user.email
      end
    end
  end
end
