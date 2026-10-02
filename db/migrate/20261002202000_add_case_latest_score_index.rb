# frozen_string_literal: true

class AddCaseLatestScoreIndex < ActiveRecord::Migration[8.1]
  def change
    add_index :case_scores, [ :case_id, :updated_at, :created_at, :id ], name: 'index_case_scores_on_case_and_latest'
  end
end
