class AddSelectionStrategyTotallyRandom < ActiveRecord::Migration[6.1]
  def change
    SelectionStrategy.where(name: 'TOTALLY_RANDOM').first_or_create(
      name: 'TOTALLY_RANDOM'
    )
  end
end
