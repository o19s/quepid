class AddMultipleRatersStrategy < ActiveRecord::Migration[6.1]
  def change
    selection_strategy = SelectionStrategy.where(name: 'Multiple Raters').first_or_create()
    selection_strategy.name = 'Multiple Raters'
    selection_strategy.description = 'Allows you to have up to three ratings for each query/doc pair.   Gives higher quality ratings, however with more work.'
    selection_strategy.save!
  end
end
