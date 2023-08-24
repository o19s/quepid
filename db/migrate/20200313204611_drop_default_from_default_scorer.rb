class DropDefaultFromDefaultScorer < ActiveRecord::Migration[4.2]
  def change
    remove_column :default_scorers, :default
  end
end
