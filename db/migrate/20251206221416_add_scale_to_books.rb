class AddScaleToBooks < ActiveRecord::Migration[8.1]
  def up
    add_column :books, :scale, :string
    add_column :books, :scale_with_labels, :text

    # Migrate existing data from scorers to books
    execute <<~SQL
      UPDATE books 
      SET scale = (SELECT scale FROM scorers WHERE scorers.id = books.scorer_id),
          scale_with_labels = (SELECT scale_with_labels FROM scorers WHERE scorers.id = books.scorer_id)
      WHERE scorer_id IS NOT NULL
    SQL

    # Set default values for books without scorers
    execute <<~SQL
      UPDATE books 
      SET scale = '',
          scale_with_labels = NULL
      WHERE scorer_id IS NULL
    SQL

    # Remove the scorer_id column
    remove_column :books, :scorer_id
  end

  def down
    add_column :books, :scorer_id, :integer

    # Note: We cannot fully restore the original scorer relationships
    # as we've lost that association. This is a destructive migration.
    
    remove_column :books, :scale
    remove_column :books, :scale_with_labels
  end
end
