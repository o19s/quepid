class FixCaseName < ActiveRecord::Migration
  def change
    rename_column :cases, :caseName, :case_name
  end
end
