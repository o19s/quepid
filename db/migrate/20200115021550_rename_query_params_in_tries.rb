class RenameQueryParamsInTries < ActiveRecord::Migration
  def change
    rename_column :tries, :queryParams, :query_params
  end
end
