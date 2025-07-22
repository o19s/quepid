class ChangeUserLlmKeyMaxLength < ActiveRecord::Migration[8.0]
  
  # we found out in 20250709144954_encrypt_existing_user_llm_keys.rb
  # that we need to make the llm_key field larger to support encrypted
  # versions of llm_key.  So inserting this to run before it.
  def change
    change_column :users, :llm_key, :string, limit: 4000
  end
end
