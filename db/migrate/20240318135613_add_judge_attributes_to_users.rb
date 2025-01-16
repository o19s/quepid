class AddJudgeAttributesToUsers < ActiveRecord::Migration[7.1]
  def change
    add_column :users, :prompt, :string, limit: 4000
    add_column :users, :openai_key, :string
  end
end
