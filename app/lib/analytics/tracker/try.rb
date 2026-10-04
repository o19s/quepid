# frozen_string_literal: true

module Analytics
  module Tracker
    module Try
      def track_try_saved_event _user, the_try
        track 'Case Tries', 'Saved a Case Try', label: the_try.case.case_name, value: the_try.try_number
      end
    end
  end
end
