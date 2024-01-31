class DropThresholdEnblFromQueries < ActiveRecord::Migration[7.1]
  # thresholds was a feature that was added in the early years of Quepid
  # but has never taken off.   Removing to simplify code base.
  def change
    remove_column :queries, :threshold_enbl
    remove_column :queries, :threshold
  end
end
