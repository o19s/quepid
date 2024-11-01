class AddJobStatusToBooks < ActiveRecord::Migration[7.2]
  def change
    add_column :books, :export_job, :string
    add_column :books, :import_job, :string
    add_column :books, :populate_job, :string
  end
end
