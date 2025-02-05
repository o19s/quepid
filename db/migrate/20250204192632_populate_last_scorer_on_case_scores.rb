class PopulateLastScorerOnCaseScores < ActiveRecord::Migration[8.0]
  # We can't assume that all the scores are from the same scorer, but we can assume the most recent used the current Case Scorer
  def up
    Case.find_each do |kase|      
      if kase.scorer.present?
        kase.scores.update_all(:scorer_id, kase.scorer.id)   
      end
    end
  end
  
  def down
    Score.update_all(scorer_id: nil)
  end
end
