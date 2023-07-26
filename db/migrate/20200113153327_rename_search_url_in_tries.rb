class RenameSearchUrlInTries < ActiveRecord::Migration[4.2]
  def change
    rename_column :tries, :searchUrl, :search_url
  end
end
