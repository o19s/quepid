class FixLastTryInCase < ActiveRecord::Migration[4.2]
  def change
    rename_column :cases, :lastTry, :last_try_number
  end
end
