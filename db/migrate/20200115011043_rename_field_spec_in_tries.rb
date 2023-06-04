class RenameFieldSpecInTries < ActiveRecord::Migration[4.2]
  def change
    rename_column :tries, :fieldSpec, :field_spec
  end
end
