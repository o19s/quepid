class FixCuratorVariablesTriesForeignKeyName < ActiveRecord::Migration[4.2]
  def change
    rename_column :curator_variables, :query_param_id, :try_id
  end
end
