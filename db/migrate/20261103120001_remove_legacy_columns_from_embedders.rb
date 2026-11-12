# frozen_string_literal: true

# There are no existing embedders to migrate; their own URL, key and timeout are no longer read
# anywhere (ADR 0005 §3's clean-up). provider is not dropped - it stays
# on Embedder, kept in sync from the connection (Connection#sync_embedder_providers).
class RemoveLegacyColumnsFromEmbedders < ActiveRecord::Migration[8.1]
  def change
    remove_column :embedders, :service_url, :string, limit: 500
    remove_column :embedders, :api_key, :string, limit: 4000
    remove_column :embedders, :timeout, :integer, default: 30, null: false
  end
end
