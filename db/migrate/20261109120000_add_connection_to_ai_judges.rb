# frozen_string_literal: true

# An AI judge (a User row) can take its URL, key and timeout from a Connection (ADR 0005) instead
# of keeping its own. The old settings (llm_key, and llm_service_url/llm_timeout in options) stay,
# and are used while connection_id is null.
class AddConnectionToAiJudges < ActiveRecord::Migration[8.1]
  def change
    add_column :users, :connection_id, :bigint
    add_index :users, :connection_id
  end
end
