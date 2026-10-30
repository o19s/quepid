# frozen_string_literal: true

class CreateEmbedders < ActiveRecord::Migration[8.1]
  def change
    create_table :embedders do |t|
      t.string  :name, null: false
      t.string  :provider, null: false, limit: 50
      t.string  :service_url, limit: 500
      t.string  :model, null: false
      t.string  :api_key, limit: 4000
      t.integer :dimensions
      t.string  :truncation, null: false, default: 'none', limit: 20
      t.text    :instruction
      t.text    :input_template
      t.integer :timeout, null: false, default: 30
      t.json    :options
      t.boolean :archived, null: false, default: false
      t.integer :owner_id
      t.timestamps
    end
    add_index :embedders, [ :owner_id, :id ]

    create_table :teams_embedders, id: false do |t|
      t.bigint :embedder_id, null: false
      t.bigint :team_id, null: false
    end
    add_index :teams_embedders, [ :embedder_id, :team_id ], unique: true
    add_index :teams_embedders, :team_id
  end
end
