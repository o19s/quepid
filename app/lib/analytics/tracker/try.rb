# frozen_string_literal: true

module Analytics
  module Tracker
    module Try
      def track_try_saved_event user, the_try
        Analytics::Ahoy.user_saved_case_try user, the_try
      end
    end
  end
end
