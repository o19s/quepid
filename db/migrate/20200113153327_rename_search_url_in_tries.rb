class RenameSearchUrlInTries < ActiveRecord::Migration
  def change
    rename_column :tries, :searchUrl, :search_url
  end
end
