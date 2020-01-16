class RenameFieldSpecInCases < ActiveRecord::Migration
  def change
    rename_column :cases, :fieldSpec, :field_spec
  end
end
