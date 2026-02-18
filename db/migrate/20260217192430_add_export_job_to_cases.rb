class AddExportJobToCases < ActiveRecord::Migration[8.1]
  def change
    add_column :cases, :export_job, :string
  end
end
