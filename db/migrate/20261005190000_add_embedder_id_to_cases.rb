# frozen_string_literal: true

class AddEmbedderIdToCases < ActiveRecord::Migration[8.1]
  def change
    add_column :cases, :embedder_id, :bigint
    add_index :cases, :embedder_id
  end
end
