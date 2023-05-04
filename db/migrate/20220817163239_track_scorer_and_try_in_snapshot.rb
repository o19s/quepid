class TrackScorerAndTryInSnapshot < ActiveRecord::Migration[6.1]
  def change
    add_reference :snapshots, :try, null: true, foreign_key: false
    add_reference :snapshots, :scorer, null: true, foreign_key: false
  end
end
