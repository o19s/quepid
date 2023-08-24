class RenameFieldSpecInCases < ActiveRecord::Migration[4.2]
  def change
    rename_column :cases, :fieldSpec, :field_spec
  end
end
