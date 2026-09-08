# frozen_string_literal: true

class AddErrorToSnapshotQueries < ActiveRecord::Migration[8.1]
  def change
    add_column :snapshot_queries, :error, :text
  end
end
