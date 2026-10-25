# frozen_string_literal: true

class RemoveObsoleteLastScoreIndex < ActiveRecord::Migration[8.1]
  def up
    # if_exists: databases created from angular-phase-10 already ran an identical copy of this migration.
    remove_index :case_scores, name: 'support_last_score', if_exists: true
  end

  def down
    add_index :case_scores, [ :updated_at, :created_at, :id ], name: 'support_last_score'
  end
end
