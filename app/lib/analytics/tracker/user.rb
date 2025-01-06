# frozen_string_literal: true

module Analytics
  module Tracker
    module User
      def track_signup_event user
        Analytics::Ahoy.user_signed_up user
      end

      def track_user_updated_profile_event user
        Analytics::Ahoy.user_updated_profile user
      end

      def track_user_updated_password_event user
        Analytics::Ahoy.user_updated_password user
      end

      def track_user_updated_by_admin_event user
        Analytics::Ahoy.user_updated_by_admin user
      end
    end
  end
end
