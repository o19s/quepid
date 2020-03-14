class DropDefaultFromDefaultScorer < ActiveRecord::Migration
  def change
    remove_column :default_scorers, :default
  end
end
