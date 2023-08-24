class RenameSearchUrlInCases < ActiveRecord::Migration[4.2]
  def change
    rename_column :cases, :searchUrl, :search_url
  end
end
