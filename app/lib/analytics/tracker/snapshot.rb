# frozen_string_literal: true

module Analytics
  module Tracker
    module Snapshot
      def track_snapshot_created_event user, snapshot
        Analytics::Ahoy.user_created_snapshot user, snapshot
      end

      def track_snapshot_deleted_event user, snapshot
        Analytics::Ahoy.user_deleted_snapshot user, snapshot
      end
    end
  end
end
