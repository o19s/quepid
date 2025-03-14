class RenameOpenaiKeyToLlmKeyInUsers < ActiveRecord::Migration[8.0]
  def change
    rename_column :users, :openai_key, :llm_key
    add_column :users, :type, :string # introduce single table inheritance    
  end
end
