# frozen_string_literal: true

class RemoveSelectionStrategyFromBooks < ActiveRecord::Migration[7.1]
  def up
    # Remove foreign key constraint first
    remove_foreign_key :books, :selection_strategies if foreign_key_exists?(:books, :selection_strategies)
    
    # Remove the column from books table
    remove_column :books, :selection_strategy_id if column_exists?(:books, :selection_strategy_id)
    
    # Drop the selection_strategies table
    drop_table :selection_strategies if table_exists?(:selection_strategies)
  end

  def down
    # Recreate selection_strategies table
    create_table :selection_strategies do |t|
      t.string :name, null: false
      t.string :description
      t.timestamps null: false
    end

    # Add selection_strategy_id column back to books
    add_column :books, :selection_strategy_id, :bigint, null: false, default: 1
    
    # Add foreign key constraint
    add_foreign_key :books, :selection_strategies
    
    # Add index
    add_index :books, :selection_strategy_id
    
    # Recreate the default selection strategies
    SelectionStrategy.create!(
      name: 'Multiple Raters',
      description: 'Allows you to have up to three ratings for each query/doc pair. Gives higher quality ratings, however with more work.'
    )
  end
end