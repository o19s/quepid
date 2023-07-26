class DropCommunalFromScorers < ActiveRecord::Migration[4.2]
  def change
    remove_column :scorers, :communal
  end
end
