# frozen_string_literal: true

class AddScoringGuidelinesToBooks < ActiveRecord::Migration[8.0]
  def change
    add_column :books, :scoring_guidelines, :text
  end
end
