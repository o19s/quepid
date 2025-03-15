class RenameOpenaiKeyToLlmKeyInUsers < ActiveRecord::Migration[8.0]
  def change
    rename_column :users, :openai_key, :llm_key   
  end
end
