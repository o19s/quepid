class AddExplanationToJudgements < ActiveRecord::Migration[7.1]
  def change
    add_column :judgements, :explanation, :text
  end
end
