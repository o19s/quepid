# frozen_string_literal: true

class AddCaseLatestScoreIndex < ActiveRecord::Migration[8.1]
  def change
    # if_not_exists: databases created from angular-phase-10 already ran an identical copy of this migration.
    add_index :case_scores, [ :case_id, :updated_at, :created_at, :id ],
              name: 'index_case_scores_on_case_and_latest', if_not_exists: true
  end
end
