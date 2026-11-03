# frozen_string_literal: true

# One connection per embedder that still has its own service_url/api_key/timeout instead of a
# connection (ADR 0005 §3). Equal settings for one owner are not re-created: compared in memory,
# since secrets are encrypted non-deterministically and can't be matched by a WHERE clause.
#
# ADR 0005 said to skip an ownerless embedder, since the old columns stayed around as a safety net
# during a deprecation period. That safety net doesn't apply here - the very next migration drops
# those columns - so an ownerless embedder gets an instance-wide connection instead (owner_id: nil
# is exactly what makes a Connection instance-wide), rather than losing its URL and key.
class BackfillConnectionsFromEmbedders < ActiveRecord::Migration[8.1]
  # The real Embedder no longer declares api_key as encrypted, or service_url/timeout as plain
  # columns (they now read through connection, which is nil for exactly the rows this migration
  # processes) - both go away once RemoveLegacyColumnsFromEmbedders runs. This migration reads the
  # still-present columns through its own stand-in instead, so it isn't coupled to the live model.
  class LegacyEmbedder < ActiveRecord::Base
    self.table_name = 'embedders'

    encrypts :api_key, deterministic: false

    has_and_belongs_to_many :teams, join_table: 'teams_embedders', foreign_key: :embedder_id
  end

  def up
    connections_by_key = {}

    LegacyEmbedder.where(connection_id: nil).find_each do |embedder|
      key = [ embedder.owner_id, embedder.provider, embedder.service_url, embedder.api_key ]
      connection = connections_by_key[key] ||= build_connection_for(embedder)
      connection.teams |= embedder.teams.to_a

      embedder.update_column(:connection_id, connection.id)
    end
  end

  def down
    raise ActiveRecord::IrreversibleMigration
  end

  private

  def build_connection_for embedder
    definition = ConnectionService.find(embedder.provider)

    Connection.create!(
      name:        "#{definition&.label || embedder.provider.titleize} Connection",
      service:     embedder.provider,
      base_url:    embedder.service_url,
      auth_scheme: definition&.auth_scheme || 'bearer',
      auth_header: definition&.auth_header,
      secret:      embedder.api_key,
      timeout:     embedder.timeout,
      owner_id:    embedder.owner_id
    )
  end
end
