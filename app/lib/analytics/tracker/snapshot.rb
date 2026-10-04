# frozen_string_literal: true

module Analytics
  module Tracker
    module Snapshot
      def track_snapshot_created_event _user, snapshot
        track 'Snapshots', 'Created a Snapshot', label: snapshot.name, value: snapshot.case.snapshots.count
      end

      def track_snapshot_deleted_event _user, snapshot
        track 'Snapshots', 'Deleted a Snapshot', label: snapshot.name
      end
    end
  end
end
