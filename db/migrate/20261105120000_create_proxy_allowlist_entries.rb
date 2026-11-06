# frozen_string_literal: true

class CreateProxyAllowlistEntries < ActiveRecord::Migration[8.1]
  def change
    create_table :proxy_allowlist_entries do |t|
      t.string :kind, null: false
      t.string :value, null: false
      t.string :note
      t.integer :created_by_id
      t.integer :updated_by_id
      t.timestamps
    end

    add_index :proxy_allowlist_entries, [ :kind, :value ], unique: true
    add_index :proxy_allowlist_entries, :created_by_id
    add_index :proxy_allowlist_entries, :updated_by_id
  end
end
