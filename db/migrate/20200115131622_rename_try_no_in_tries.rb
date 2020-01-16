class RenameTryNoInTries < ActiveRecord::Migration
  def change
    rename_column :tries, :tryNo, :try_number
  end
end
