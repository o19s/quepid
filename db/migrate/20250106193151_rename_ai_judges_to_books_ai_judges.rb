class RenameAiJudgesToBooksAiJudges < ActiveRecord::Migration[8.0]
  def change
    rename_table :ai_judges, :books_ai_judges
  end
end
