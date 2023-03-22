class AddDescriptionToSelectionStrategy < ActiveRecord::Migration[6.1]
  def change
    add_column :selection_strategies, :description, :string
  end
end
