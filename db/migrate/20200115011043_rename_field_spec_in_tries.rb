class RenameFieldSpecInTries < ActiveRecord::Migration
  def change
    rename_column :tries, :fieldSpec, :field_spec
  end
end
