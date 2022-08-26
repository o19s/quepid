class AddRicherFieldsToScorers < ActiveRecord::Migration[6.1]
  def change
    add_column :scorers, :tooltip, :string
    add_column :scorers, :description, :text
    add_column :scorers, :rollup_method, :integer, default: 0
  end
end
