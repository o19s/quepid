class FixLastTryInCase < ActiveRecord::Migration
  def change
    rename_column :cases, :lastTry, :last_try_number
  end
end
