class RenamePromptToSystemPromptForUser < ActiveRecord::Migration[8.0]
  def change
    rename_column :users, :prompt, :system_prompt
  end
end
