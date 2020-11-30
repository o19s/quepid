class TrackSnapshotType < ActiveRecord::Migration
  def self.up
    Lhm.change_table :snapshot_docs do |m|
      m.ddl("alter table %s add column rated_only tinyint(1) default '0' NOT NULL" % m.name)
    end
  end

  def self.down
    Lhm.change_table :snapshot_docs do |m|
      m.remove_column :rated_only
    end
  end
end
