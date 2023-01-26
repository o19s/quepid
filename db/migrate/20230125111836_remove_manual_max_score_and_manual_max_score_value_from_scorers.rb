class RemoveManualMaxScoreAndManualMaxScoreValueFromScorers < ActiveRecord::Migration[6.1]
  # The only scorer that uses this is nDCG, and we don't actualy need it to be
  # configurable so let's simplify our lives and get rid of it.
  def change
    remove_column :scorers, :manual_max_score
    remove_column :scorers, :manual_max_score_value
  end
end
