class AddLastScoreSupportingIndex < ActiveRecord::Migration[7.0]
  def change
    # The case.last_score call is very slow as it does a lot of sorting.
    # Help this out!
    add_index :case_scores, [ :updated_at, :created_at, :id ], 
      name: 'support_last_score'
    
    # Let's support the look up of cases by case_id and try_id.
    add_index :case_scores, :try_id
  end
end
