# frozen_string_literal: true

# A Connection is how to reach one external service and authenticate to it (ADR 0005). It knows
# nothing about what the service is used for: judges and embedders will point at one later.
class CreateConnections < ActiveRecord::Migration[8.1]
  def change
    create_table :connections do |t|
      t.string  :name, null: false
      t.string  :service, null: false, limit: 50
      t.string  :base_url, limit: 500
      t.string  :auth_scheme, null: false, default: 'bearer', limit: 20
      t.string  :auth_header, limit: 100
      t.string  :secret, limit: 4000
      t.json    :extra_headers
      t.integer :timeout, null: false, default: 30
      t.integer :requests_per_minute, null: false, default: 0
      t.json    :options
      t.boolean :archived, null: false, default: false
      t.integer :owner_id
      t.timestamps
    end
    add_index :connections, [ :owner_id, :id ]

    create_table :teams_connections, id: false do |t|
      t.bigint :connection_id, null: false
      t.bigint :team_id, null: false
    end
    add_index :teams_connections, [ :connection_id, :team_id ], unique: true
    add_index :teams_connections, :team_id
  end
end
