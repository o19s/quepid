class RemoveScorerType < ActiveRecord::Migration
  # Note: we are leaving the default_scorer table alone for now in case
  # we need to bring it back, we don't want to lose the data.  Just in case..
  def change


    remove_column :cases,   :scorer_type
    remove_column :queries, :scorer_type
  end
end
