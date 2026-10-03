# frozen_string_literal: true

class RemoveObsoleteLastScoreIndex < ActiveRecord::Migration[8.1]
  def up
    remove_index :case_scores, name: 'support_last_score'
  end

  def down
    add_index :case_scores, [ :updated_at, :created_at, :id ], name: 'support_last_score'
  end
end
