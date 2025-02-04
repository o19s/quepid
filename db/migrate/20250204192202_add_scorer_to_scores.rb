class AddScorerToScores < ActiveRecord::Migration[8.0]
  def change
    add_reference :case_scores, :scorer, null: true, foreign_key: false
  end
end
