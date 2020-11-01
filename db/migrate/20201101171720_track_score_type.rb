class TrackScoreType < ActiveRecord::Migration
  def change
    add_column :case_scores, :rated_only, :boolean, default: false
    add_index "case_scores", ["rated_only"], name: "case_scores_rated_only_idx", using: :btree
  end
end
