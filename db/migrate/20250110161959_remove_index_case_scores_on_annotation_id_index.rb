class RemoveIndexCaseScoresOnAnnotationIdIndex < ActiveRecord::Migration[8.0]
  def change
    remove_index 'case_scores', name: 'index_case_scores_on_annotation_id'
  end
end
