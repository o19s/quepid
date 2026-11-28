# frozen_string_literal: true

# AI judges call their providers through connections. MigrateAiJudgesToConnections copied each
# judge's key onto a connection and left this column for this cleanup; nothing reads it now.
class RemoveLlmKeyFromUsers < ActiveRecord::Migration[8.1]
  def change
    remove_column :users, :llm_key, :string, limit: 4000
  end
end
