# frozen_string_literal: true

# An embedder can take its URL, key and timeout from a Connection (ADR 0005) instead of keeping
# its own. The old columns stay, and are used when connection_id is null.
class AddConnectionToEmbedders < ActiveRecord::Migration[8.1]
  def change
    add_column :embedders, :connection_id, :bigint
    add_index :embedders, :connection_id
  end
end
