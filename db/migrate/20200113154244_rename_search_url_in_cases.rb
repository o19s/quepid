class RenameSearchUrlInCases < ActiveRecord::Migration
  def change
    rename_column :cases, :searchUrl, :search_url
  end
end
