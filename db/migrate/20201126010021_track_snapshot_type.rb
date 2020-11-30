# This migration is unique in that the hosted Quepid staging and production databases
# have so much data that the migration fails.  For those, we contact tech support
# and have them run the migration, and then just do a
# INSERT INTO schema_migrations VALUES ('20201126010021') to fake out Rails
class TrackSnapshotType < ActiveRecord::Migration
  def change
    add_column :snapshot_docs, :rated_only, :boolean, default: false
  end
end
