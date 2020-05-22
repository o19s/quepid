class RemoveScorerType < ActiveRecord::Migration
  def change
    remove_column :cases,   :scorer_type
    remove_column :queries, :scorer_type
  end
end
