class AddAiJudgeToBook < ActiveRecord::Migration[7.1]
  def change
    add_column :books, :ai_judge_id, :integer
  end
end
