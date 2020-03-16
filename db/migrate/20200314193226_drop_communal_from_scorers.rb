class DropCommunalFromScorers < ActiveRecord::Migration
  def change
    remove_column :scorers, :communal    
  end
end
