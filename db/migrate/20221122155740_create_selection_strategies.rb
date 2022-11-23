class CreateSelectionStrategies < ActiveRecord::Migration[6.1]
  def change
    create_table :selection_strategies do |t|
      t.string :name

      t.timestamps
    end
  end
end
