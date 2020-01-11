class RenameSearchEngine < ActiveRecord::Migration
  def change
    rename_column :tries, :searchEngine, :search_engine
  end
end
