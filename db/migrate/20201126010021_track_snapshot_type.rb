class TrackSnapshotType < ActiveRecord::Migration
  def self.up
    remove_foreign_key :snapshot_docs, :snapshot_queries
    Lhm.change_table :snapshot_docs do |m|
      m.ddl("alter table %s add column rated_only tinyint(1) default '0' NOT NULL" % m.name)
    end
    add_foreign_key :snapshot_docs, :snapshot_queries
  end

  def self.down
    Lhm.change_table :snapshot_docs do |m|
      m.remove_column :rated_only
    end
  end
end
