class RenameThresholdEnblToThresholdEnabledOnQueries < ActiveRecord::Migration[7.0]
  def change
    rename_column :queries, :threshold_enbl, :threshold_enabled
  end
end
