class AddNightlyRunFlagToCase < ActiveRecord::Migration[8.0]
  def change
    add_column :cases, :nightly, :boolean
  end
end
