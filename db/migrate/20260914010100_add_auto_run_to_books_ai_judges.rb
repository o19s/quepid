# frozen_string_literal: true

class AddAutoRunToBooksAiJudges < ActiveRecord::Migration[8.1]
  def change
    add_column :books_ai_judges, :auto_run, :boolean, default: false, null: false
  end
end
