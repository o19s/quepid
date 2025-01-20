class ExtendQueryTextLength < ActiveRecord::Migration[7.1]
  def up
    change_column :queries, :query_text, :string, limit: 2048
  end

  def down
    change_column :queries, :query_text, :string, limit: 500
  end
end
