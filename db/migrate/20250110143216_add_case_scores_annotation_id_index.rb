class AddCaseScoresAnnotationIdIndex < ActiveRecord::Migration[8.0]
  def change
    add_index :case_scores, :annotation_id, name: :index_case_scores_annotation_id, unique: true
  end
end
