class RenameTryNoInTries < ActiveRecord::Migration[4.2]
  def change
    rename_column :tries, :tryNo, :try_number
  end
end
