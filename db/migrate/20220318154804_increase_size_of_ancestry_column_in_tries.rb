class IncreaseSizeOfAncestryColumnInTries < ActiveRecord::Migration[6.1]
  def up
    change_column :tries, :ancestry, :string, :limit => 3072
  end

  def down
    change_column :tries, :ancestry, :string, :limit => 255
  end
end
