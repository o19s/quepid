class RenameSelectionStrategy < ActiveRecord::Migration[6.1]
  def change
    selection_strategy = SelectionStrategy.where(name: 'TOTALLY_RANDOM').first_or_create(
      name: 'Single Rater',
      description: 'A single rating for each query/doc pair is all that is required.  The fastest way to get a lot of ratings, with lower quality.'
    )
    selection_strategy.save!
  end
end
