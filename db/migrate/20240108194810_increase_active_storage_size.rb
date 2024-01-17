class IncreaseActiveStorageSize < ActiveRecord::Migration[7.1]
  def up
    change_column :active_storage_db_files, :data, :binary, limit: 100.megabytes
  end

  def down
    change_column :active_storage_db_files, :data, :binary, limit: nil
  end
end
