class RenameSearchEngine < ActiveRecord::Migration[4.2]
  def change
    rename_column :tries, :searchEngine, :search_engine
  end
end
