class AddPublicFlagToCase < ActiveRecord::Migration[6.1]
  def change
    add_column :cases, :public, :boolean
  end
end
