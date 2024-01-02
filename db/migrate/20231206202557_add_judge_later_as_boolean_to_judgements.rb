class AddJudgeLaterAsBooleanToJudgements < ActiveRecord::Migration[7.1]
  def change
    add_column :judgements, :judge_later, :boolean, :default => false
  end
end
