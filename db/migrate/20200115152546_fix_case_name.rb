class FixCaseName < ActiveRecord::Migration[4.2]
  def change
    rename_column :cases, :caseName, :case_name
  end
end
