class AddAncestryToTries < ActiveRecord::Migration[6.1]
  def change
    add_column :tries, :ancestry, :string
    add_index :tries, :ancestry
  end
end
